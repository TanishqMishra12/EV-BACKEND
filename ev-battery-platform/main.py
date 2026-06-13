import asyncio
from contextlib import asynccontextmanager
import logging
import os
from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from auth.dependencies import verify_jwt
from db.session import get_db
from routers import auth, fleet, ingest, telemetry, soh, rul, analytics
from services.sqs_poller import init_queues, poll_loop, get_sqs_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    testing = os.getenv("TESTING", "false").lower() == "true"
    stop_event = asyncio.Event()
    poll_task = None

    if not testing:
        # Startup: auto-create queues in dev and run polling loop
        init_queues()

        queue_url = os.getenv("SQS_QUEUE_URL")
        dlq_url = os.getenv("SQS_DLQ_URL")

        if queue_url and dlq_url:
            poll_task = asyncio.create_task(poll_loop(queue_url, dlq_url, stop_event))
            app.state.sqs_poll_task = poll_task
            app.state.sqs_stop_event = stop_event
            logger.info("SQS Poller task spawned successfully.")
        else:
            logger.warning("SQS environment variables not set. Poller loop skipped.")

    yield

    # Shutdown: cleanly signal stop and wait for poller task
    if poll_task:
        logger.info("Stopping SQS Poller task...")
        stop_event.set()
        try:
            await asyncio.wait_for(poll_task, timeout=10.0)
            logger.info("SQS Poller stopped successfully.")
        except asyncio.TimeoutError:
            logger.warning("Timeout occurred while stopping SQS Poller.")
        except Exception as e:
            logger.error(f"Error while stopping SQS Poller: {e}")



app = FastAPI(
    title="EV Battery Telemetry & Diagnostics",
    description="Ingest, query, and analyse EV battery telemetry data.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Routers ──────────────────────────────────────────────────────────────────
# Authentication (unprotected)
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Core endpoints
# Ingest is now internally verified using API Key (no verify_jwt constraint at router level)
app.include_router(ingest.router, prefix="/api/v1", tags=["Ingest"])
app.include_router(telemetry.router, prefix="/api/v1", tags=["Telemetry"], dependencies=[Depends(verify_jwt)])
app.include_router(soh.router, prefix="/api/v1", tags=["State of Health"], dependencies=[Depends(verify_jwt)])
app.include_router(rul.router, prefix="/api/v1", tags=["RUL Predictions"], dependencies=[Depends(verify_jwt)])
app.include_router(analytics.router, prefix="/api/v1", tags=["Analytics"], dependencies=[Depends(verify_jwt)])

# Fleet diagnostics (requires fleet_admin, handled via route-level dependency)
app.include_router(fleet.router, prefix="/api/v1", tags=["Fleet"])


@app.get("/health", tags=["Health"])
def health_check():
    """Simple liveness probe."""
    return {"status": "ok"}


@app.get("/ready", tags=["Health"])
def ready_check(db: Session = Depends(get_db)):
    """Readiness probe that checks database connectivity and SQS queue status."""
    db_connected = False
    sqs_reachable = False

    # 1. Database check
    try:
        db.execute(text("SELECT 1"))
        db_connected = True
    except Exception:
        db_connected = False

    # 2. SQS check
    queue_url = os.getenv("SQS_QUEUE_URL")
    if not queue_url:
        sqs_reachable = False
    else:
        try:
            sqs = get_sqs_client()
            sqs.get_queue_attributes(QueueUrl=queue_url, AttributeNames=["QueueArn"])
            sqs_reachable = True
        except Exception:
            sqs_reachable = False

    # Return 200 if ready
    if db_connected and sqs_reachable:
        return {
            "status": "ready",
            "db": "connected",
            "sqs": "reachable",
        }

    # Otherwise return 503 Service Unavailable
    db_status = "connected" if db_connected else "disconnected"
    sqs_status = "reachable" if sqs_reachable else "unreachable"

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={
            "status": "not ready",
            "db": db_status,
            "sqs": sqs_status,
        },
    )

