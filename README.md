# EV Battery Telemetry & Diagnostics Platform

A full-stack platform for EV battery telemetry ingestion, real-time diagnostics, and predictive analytics — built with **FastAPI**, **PostgreSQL/TimescaleDB**, **React (Vite)**, and **Docker**.

---

## Table of Contents

- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Quick Start (Docker Compose)](#quick-start-docker-compose)
- [Manual Setup (Without Docker)](#manual-setup-without-docker)
  - [Backend (FastAPI)](#backend-fastapi)
  - [Frontend (React + Vite)](#frontend-react--vite)
- [Services & Ports](#services--ports)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [AWS SQS FIFO Integration](#aws-sqs-fifo-integration)
- [Production Hardening](#production-hardening)
- [Testing & Verification](#testing--verification)
- [Useful Commands](#useful-commands)

---

## Architecture

```
                                  ┌─────────────┐
                                  │ EV Sim/AWS  │
                                  └─────────────┘
                                         │ SQS Message (Phase 2 FIFO)
                                         ▼
   ┌─────────────┐   HTTP Ingest   ┌───────────┐ (Polls)   ┌───────────┐
   │ Sim/Internal│ ──────────────▶ │  FastAPI  │ ◀──────── │ ElasticMQ │
   │ Client      │  (X-API-Key)    │  (8000)   │           └───────────┘
   └─────────────┘                 └───────────┘
                                         │
                          ┌──────────────┼──────────────┐
                          ▼              │              ▼
                   ┌──────────────┐      │       ┌─────────────┐
                   │ PostgreSQL   │      │       │   React UI  │
                   │ + TimescaleDB│      │       │ (Vite :5173)│
                   │ (5432)       │      │       └─────────────┘
                   └──────────────┘      ▼
                                  Background Tasks
                                  ➜ calculate_soh()
                                  ➜ predict_rul() (LSTM Inference every 10th message)
```

---

## Repository Structure

```
.
├── .gitignore                    # Git ignore rules
├── README.md                     # ← You are here
│
├── ev-battery-platform/          # Backend (FastAPI + Alembic + ML)
│   ├── main.py                   # FastAPI application entry point
│   ├── routers/                  # API route handlers
│   │   ├── auth.py               # Authentication (login, register, refresh)
│   │   ├── ingest.py             # Telemetry ingestion (API-key protected)
│   │   ├── telemetry.py          # Telemetry queries (JWT protected)
│   │   ├── soh.py                # State of Health endpoint
│   │   ├── rul.py                # Remaining Useful Life predictions
│   │   ├── analytics.py          # Degradation analytics
│   │   └── fleet.py              # Fleet summary (fleet_admin only)
│   ├── auth/                     # JWT authentication & rate limiting
│   ├── db/                       # Database session & connection
│   ├── models/                   # SQLAlchemy ORM models
│   ├── services/                 # Business logic & SQS poller
│   ├── ml/                       # LSTM model for RUL prediction
│   ├── alembic/                  # Database migration scripts
│   ├── tests/                    # Unit & integration tests
│   ├── scripts/                  # Utility scripts (key rotation, perf tests)
│   ├── simulator/                # EV battery data simulator
│   ├── cleaned_dataset/          # Battery charge/discharge CSV data
│   ├── docker-compose.yml        # Docker orchestration
│   ├── Dockerfile                # Backend container image
│   ├── requirements.txt          # Python dependencies
│   └── .env.example              # Environment variable template
│
├── ev-diagnostics-ui/            # Frontend (React + Vite + TailwindCSS)
│   ├── src/
│   │   ├── App.jsx               # Main app component with routing
│   │   ├── main.jsx              # React entry point
│   │   ├── pages/                # Page components
│   │   │   ├── LoginPage.jsx     # User authentication page
│   │   │   ├── DashboardPage.jsx # Fleet overview dashboard
│   │   │   ├── MyBatteryPage.jsx # Battery listing & management
│   │   │   ├── BatteryDetailPage.jsx  # Individual battery diagnostics
│   │   │   └── AnalyticsPage.jsx # Degradation analytics & charts
│   │   ├── components/           # Reusable UI components
│   │   │   ├── Layout.jsx        # App layout wrapper
│   │   │   ├── Sidebar.jsx       # Navigation sidebar
│   │   │   ├── TopBar.jsx        # Top navigation bar
│   │   │   ├── BatteryTile.jsx   # Battery card component
│   │   │   ├── DarkChart.jsx     # Styled chart wrapper (Recharts)
│   │   │   ├── MetricCard.jsx    # KPI metric display card
│   │   │   ├── StatusDot.jsx     # Health status indicator
│   │   │   └── ProtectedRoute.jsx # Auth route guard
│   │   ├── api/                  # API client utilities
│   │   ├── contexts/             # React context providers
│   │   └── styles/               # Global CSS styles
│   ├── Dockerfile                # Frontend container (multi-stage build)
│   ├── package.json              # Node.js dependencies
│   └── .env.local                # Frontend environment config
│
└── docs/                         # Project documentation
    ├── DEPLOYMENT.md             # Deployment guide
    ├── lstm_schema_proposal.md   # LSTM model schema design
    ├── checkpoint_c_demo.md      # Checkpoint C demo notes
    ├── checkpoint_e_summary.md   # Checkpoint E summary
    ├── openapi.json              # OpenAPI 3.0 specification (JSON)
    └── openapi.yaml              # OpenAPI 3.0 specification (YAML)
```

---

## Prerequisites

| Tool        | Version  | Purpose                          |
|-------------|----------|----------------------------------|
| **Docker**  | ≥ 24.0   | Container runtime                |
| **Docker Compose** | ≥ 2.20 | Service orchestration       |
| **Python**  | ≥ 3.12   | Backend (only for manual setup)  |
| **Node.js** | ≥ 22.0   | Frontend (only for manual setup) |
| **npm**     | ≥ 10.0   | Package manager (manual setup)   |

---

## Quick Start (Docker Compose)

> **Recommended** — This starts all services (database, backend, SQS emulator, and frontend) with a single command.

### Step 1: Navigate to the backend directory

```bash
cd ev-battery-platform
```

### Step 2: Configure environment variables

```bash
# Copy the example env file (default values work out of the box)
cp .env.example .env
```

### Step 3: Build and start all services

```bash
docker compose up -d --build
```

This starts:
- **PostgreSQL + TimescaleDB** on port `5432`
- **FastAPI backend** on port `8000`
- **ElasticMQ (SQS emulator)** on ports `9324` / `9325`
- **React frontend** on port `5173`

> ⏳ **First-time build** takes 5–8 minutes (downloads Python ML libraries like PyTorch ~192MB). Subsequent runs are near-instant due to Docker layer caching.

### Step 4: Run database migrations

```bash
docker compose exec fastapi alembic upgrade head
```

### Step 5: Verify everything is running

```bash
# Health check (liveness)
curl http://localhost:8000/health
# Expected: {"status": "ok"}

# Readiness check (database + SQS connectivity)
curl http://localhost:8000/ready
# Expected: {"status": "ready", "db": "connected", "sqs": "reachable"}

# Check all containers
docker compose ps
```

### Step 6: Open the app

| Service          | URL                                    |
|------------------|----------------------------------------|
| 🖥️ Frontend UI   | http://localhost:5173                  |
| ⚡ Backend API    | http://localhost:8000                  |
| 📖 Swagger Docs   | http://localhost:8000/docs             |
| 📨 SQS Admin      | http://localhost:9325                  |

---

## Manual Setup (Without Docker)

Use this approach if you want to run services directly on your machine for development.

### Backend (FastAPI)

> **Requires:** Python 3.12+, a running PostgreSQL instance

```bash
# 1. Navigate to the backend directory
cd ev-battery-platform

# 2. Create and activate a virtual environment
python -m venv venv

# On Windows (PowerShell)
.\venv\Scripts\Activate

# On macOS/Linux
source venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

# 4. Configure environment variables
cp .env.example .env
# Edit .env and update DATABASE_URL to point to your local Postgres:
#   DATABASE_URL=postgresql://ev_user:ev_password@localhost:5432/ev_telemetry

# 5. Run database migrations
alembic upgrade head

# 6. Start the FastAPI development server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend API will be available at **http://localhost:8000**.  
Interactive docs at **http://localhost:8000/docs**.

---

### Frontend (React + Vite)

> **Requires:** Node.js 22+, npm 10+

```bash
# 1. Navigate to the frontend directory
cd ev-diagnostics-ui

# 2. Install Node.js dependencies
npm install

# 3. Configure API URL (create .env.local if it doesn't exist)
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local

# 4. Start the Vite development server
npm run dev
```

The frontend will be available at **http://localhost:5173** with hot module replacement (HMR).

#### Other frontend commands

```bash
# Production build
npm run build

# Preview production build locally
npm run preview

# Lint the codebase
npm run lint
```

---

## Services & Ports

| Service                   | Port   | Description                                    |
|---------------------------|--------|------------------------------------------------|
| React Frontend (Vite/Nginx) | `5173` | EV Diagnostics dashboard UI                  |
| FastAPI Backend           | `8000` | REST API for telemetry, diagnostics, analytics |
| PostgreSQL + TimescaleDB  | `5432` | Time-series database for telemetry data        |
| ElasticMQ (SQS Emulator)  | `9324` | Local AWS SQS FIFO queue emulator              |
| ElasticMQ Admin UI        | `9325` | Queue management web console                   |

---

## API Endpoints

### Authentication (Unprotected)

| Method | Endpoint          | Description              |
|--------|-------------------|--------------------------|
| POST   | `/auth/register`  | Register a new user      |
| POST   | `/auth/login`     | Login and receive JWT    |
| POST   | `/auth/refresh`   | Refresh an active JWT    |

### Telemetry Ingestion (API Key Protected)

| Method | Endpoint          | Header Required                              |
|--------|-------------------|----------------------------------------------|
| POST   | `/api/v1/ingest`  | `X-Internal-API-Key: super_secret_internal_api_key_123` |

**Example:**
```bash
curl -X POST http://localhost:8000/api/v1/ingest \
  -H "Content-Type: application/json" \
  -H "X-Internal-API-Key: super_secret_internal_api_key_123" \
  -d '{
    "schema_version": "1.0",
    "source": "ev_simulator_local",
    "battery_id": "EV_B0005_001",
    "vehicle_id": "VH_TESLA_042",
    "timestamp": "2024-01-15T14:23:45.123Z",
    "cycle_number": 147,
    "cycle_type": "discharge",
    "measurements": {
      "voltage_v": 3.8124,
      "current_a": -1.9987,
      "temperature_c": 24.5,
      "capacity_mah": 1823.4,
      "internal_resistance_ohm": 0.0214
    }
  }'
```
**Response (202):** `{"ingested": true, "battery_id": "EV_B0005_001"}`

### JWT Protected Endpoints

> All endpoints below require the header: `Authorization: Bearer <JWT_TOKEN>`

| Method | Endpoint                         | Description                      |
|--------|----------------------------------|----------------------------------|
| GET    | `/api/v1/telemetry/{battery_id}` | Query telemetry (cursor pagination) |
| GET    | `/api/v1/soh/{battery_id}`       | Current SOH status & trend       |
| GET    | `/api/v1/rul/{battery_id}`       | RUL prediction with confidence   |
| GET    | `/api/v1/analytics/degradation`  | Degradation analytics (date range) |
| GET    | `/api/v1/fleet/summary`          | Fleet overview (fleet_admin only) |

**RUL Response Example:**
```json
{
  "battery_id": "EV_B0005_001",
  "predicted_rul_cycles": 213,
  "confidence_interval": {
    "lower_bound": 188,
    "upper_bound": 238,
    "confidence_percent": 90.0
  },
  "current_soh_percent": 82.4,
  "eol_threshold_soh": 70.0,
  "model_version": "v2.0",
  "predicted_at": "2024-01-15T14:20:00.000Z",
  "alert_level": "none"
}
```

---

## Environment Variables

The `.env` file is used by both Docker Compose and the FastAPI backend. Copy `.env.example` to `.env` to get started:

| Variable                  | Default Value                                                      | Description                               |
|---------------------------|--------------------------------------------------------------------|-------------------------------------------|
| `POSTGRES_USER`           | `ev_user`                                                          | PostgreSQL username                       |
| `POSTGRES_PASSWORD`       | `ev_password`                                                      | PostgreSQL password                       |
| `POSTGRES_DB`             | `ev_telemetry`                                                     | PostgreSQL database name                  |
| `DATABASE_URL`            | `postgresql://ev_user:ev_password@postgres:5432/ev_telemetry`      | SQLAlchemy connection string              |
| `INTERNAL_API_KEY`        | `super_secret_internal_api_key_123`                                | API key for telemetry ingestion           |
| `SQS_ENDPOINT_URL`        | `http://elasticmq:9324`                                           | SQS (ElasticMQ) endpoint                 |
| `SQS_QUEUE_URL`           | `http://elasticmq:9324/000000000000/ev-telemetry.fifo`            | Main SQS FIFO queue URL                  |
| `SQS_DLQ_URL`             | `http://elasticmq:9324/000000000000/ev-telemetry-dlq.fifo`       | Dead-letter queue URL                     |
| `AWS_REGION`              | `us-east-1`                                                        | AWS region                                |
| `AWS_ACCESS_KEY_ID`       | `mock_key`                                                         | AWS access key (mock for local dev)       |
| `AWS_SECRET_ACCESS_KEY`   | `mock_secret`                                                      | AWS secret key (mock for local dev)       |
| `CREATE_QUEUES_ON_STARTUP`| `true`                                                             | Auto-create SQS queues on startup         |

**Frontend environment** (`.env.local` in `ev-diagnostics-ui/`):

| Variable             | Default Value              | Description                |
|----------------------|----------------------------|----------------------------|
| `VITE_API_BASE_URL`  | `http://localhost:8000`    | Backend API base URL       |

---

## AWS SQS FIFO Integration

- **Production Queue:** `ev-telemetry.fifo`
- **Production DLQ:** `ev-telemetry-dlq.fifo`
- **Processing Rule:** Telemetry parsing/validation errors are retried up to 3 times in-memory. On the 3rd fail, they are routed to the DLQ with an attached `Error` attribute and deleted from the main queue.
- **Local Emulator Console:** SQS emulator admin UI is available at http://localhost:9325.

---

## Production Hardening

### 1. Rate Limiting (`slowapi`)
Rate limiting is enforced globally at **100 requests/minute** per authenticated user on all `/api/v1/*` routes.
- **User Extraction**: Keys are bound to the JWT token's subject (`sub`/username) rather than client IP.
- **Exemptions**: Health checks (`/health`, `/ready`) and internal telemetry ingestion (`/api/v1/ingest`) are exempted.
- **Error Response**: Rejections return HTTP `429 Too Many Requests` with a JSON payload: `{"error": "Rate limit exceeded", "retry_after_seconds": X}` and a `Retry-After` header.

### 2. Structured JSON Logging (`structlog`)
All application logs are printed in JSON format to `stdout` for compatibility with modern log routers.
- **Request Middleware**: Logs every processed request with method, path, HTTP status, duration (ms), and authenticated user.
- **Ingestion Metrics**: Ingestion workflows log combined write and SoH calculation latency (`latency_ms`), battery ID, cycle, and source (`http`/`poller`).

### 3. TimescaleDB Compression Policy
TimescaleDB data compression is enabled on the `telemetry` table. Chunks are ordered by `recorded_at DESC` and segmented by `battery_id`.
- An automated database compression policy compresses telemetry records older than **7 days**.

### 4. JWT Key Rotation & Token Refresh
- **Key Rotation**: Archive older RSA public keys under `previous_keys/`. The authentication module scans this folder to allow previously-signed tokens to validate successfully.
- **Token Reissue**: Call `POST /auth/refresh` with a valid active access token to receive a re-signed token.
- **Manual Rotation**:
  ```bash
  python scripts/rotate_keys.py
  ```

---

## Testing & Verification

### 1. Running Unit/Integration Tests
The Python tests run against an in-memory SQLite database:
```bash
cd ev-battery-platform
pip install -r requirements.txt
python -m pytest tests/ -v
```

### 2. Backup & Restore Validation
Simulate PostgreSQL/TimescaleDB backup and restoration:
```bash
# On Linux/macOS
./scripts/backup_restore_test.sh

# On Windows (PowerShell)
powershell -File ./scripts/backup_restore_test.ps1
```

### 3. Performance Benchmark (Load Testing)
Simulate **50 RPS for 60 seconds (3,000 total requests)** with a weighted, read-heavy API distribution:
```bash
python scripts/perf_test.py
```
**SLAs:** p95 < 150ms, p99 < 300ms, 0% failure rate.

---

## Useful Commands

### Docker Compose

```bash
# Start all services (first time — builds images)
docker compose up -d --build

# Start all services (subsequent runs — uses cached images)
docker compose up -d

# Check status of all containers
docker compose ps

# View backend logs (live)
docker compose logs fastapi --tail 50 -f

# View frontend logs (live)
docker compose logs frontend --tail 50 -f

# View database logs
docker compose logs postgres --tail 50 -f

# Run database migrations
docker compose exec fastapi alembic upgrade head

# Open a shell inside the backend container
docker compose exec fastapi bash

# Stop all services
docker compose down

# Stop all services and delete database volume (full reset)
docker compose down -v

# Rebuild a single service
docker compose up -d --build fastapi
docker compose up -d --build frontend
```

### Backend (Manual)

```bash
# Start with hot reload
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Run migrations
alembic upgrade head

# Create a new migration
alembic revision --autogenerate -m "description"

# Run tests
python -m pytest tests/ -v
```

### Frontend (Manual)

```bash
# Start dev server with HMR
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

---

## Tech Stack

| Layer          | Technology                                      |
|----------------|-------------------------------------------------|
| **Frontend**   | React 19, Vite 8, TailwindCSS 4, Recharts, React Router |
| **Backend**    | FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2   |
| **Database**   | PostgreSQL 16 + TimescaleDB                     |
| **ML**         | PyTorch (LSTM), scikit-learn, NumPy, Pandas      |
| **Auth**       | JWT (RSA256) with key rotation                   |
| **Queue**      | AWS SQS FIFO (ElasticMQ for local dev)           |
| **Infra**      | Docker, Docker Compose, Nginx (frontend prod)    |
| **Logging**    | structlog (JSON to stdout)                       |
| **Rate Limit** | slowapi (100 req/min per user)                   |
