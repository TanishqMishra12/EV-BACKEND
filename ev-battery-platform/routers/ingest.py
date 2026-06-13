"""
POST /api/v1/ingest — Battery telemetry ingestion endpoint.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.orm import Session

from db.models import Battery, Telemetry
from db.session import get_db
from models.schemas import IngestPayload, IngestResponse
from services.soh_service import calculate_soh

router = APIRouter()

DEFAULT_NOMINAL_CAPACITY_MAH = 2000.0


@router.post(
    "/ingest",
    response_model=IngestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingest a single telemetry reading",
)
def ingest_telemetry(
    payload: IngestPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Validate and persist a telemetry reading.

    - Auto-creates the battery record if it doesn't already exist.
    - Triggers SoH recalculation as a background task.
    """
    # ── Ensure battery exists ────────────────────────────────────────────
    battery = db.query(Battery).filter(Battery.battery_id == payload.battery_id).first()
    if battery is None:
        battery = Battery(
            battery_id=payload.battery_id,
            vehicle_id=payload.vehicle_id,
            nominal_capacity_mah=DEFAULT_NOMINAL_CAPACITY_MAH,
        )
        db.add(battery)
        db.flush()  # assign PK before FK reference

    # ── Insert telemetry row ─────────────────────────────────────────────
    reading = Telemetry(
        battery_id=payload.battery_id,
        recorded_at=payload.timestamp,
        cycle_number=payload.cycle_number,
        voltage_v=payload.measurements.voltage_v,
        current_a=payload.measurements.current_a,
        temperature_c=payload.measurements.temperature_c,
        capacity_mah=payload.measurements.capacity_mah,
        cycle_type=payload.cycle_type,
    )
    db.add(reading)
    db.commit()

    # ── Trigger SoH calculation in the background ────────────────────────
    background_tasks.add_task(calculate_soh, payload.battery_id)

    return IngestResponse(ingested=True, battery_id=payload.battery_id)
