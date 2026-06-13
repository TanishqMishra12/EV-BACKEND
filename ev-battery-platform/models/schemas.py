"""
Pydantic schemas for request validation and response serialization.

Covers:
  - IngestPayload:          POST /api/v1/ingest request body
  - IngestResponse:         POST /api/v1/ingest response
  - TelemetryReading:       Single reading in telemetry list
  - TelemetryResponse:      GET /api/v1/telemetry/{battery_id} response
  - SoHTrendEntry:          Single point in SoH trend history
  - SoHTrend:               Trend block inside SoH response
  - SoHResponse:            GET /api/v1/soh/{battery_id} response
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# POST /api/v1/ingest
# ---------------------------------------------------------------------------


class Measurements(BaseModel):
    voltage_v: float = Field(..., description="Battery voltage in volts")
    current_a: float = Field(..., description="Current in amps (negative = discharge)")
    temperature_c: float = Field(..., description="Temperature in Celsius")
    capacity_mah: float = Field(..., description="Remaining capacity in mAh")
    internal_resistance_ohm: Optional[float] = Field(
        None, description="Internal resistance in ohms (accepted but not persisted)"
    )


class Metadata(BaseModel):
    """Flexible metadata block — accepts any extra keys."""
    model_config = {"extra": "allow"}

    simulator_version: Optional[str] = None
    replay_speed: Optional[float] = None
    source_file: Optional[str] = None


class IngestPayload(BaseModel):
    schema_version: str = Field(..., description="Data contract version")
    source: str = Field(..., description="Data source identifier")
    battery_id: str = Field(..., max_length=32)
    vehicle_id: str = Field(..., max_length=64)
    timestamp: datetime = Field(..., description="Measurement timestamp (ISO 8601)")
    cycle_number: int = Field(..., ge=0)
    cycle_type: str = Field(..., max_length=16, description="'charge' or 'discharge'")
    measurements: Measurements
    metadata: Optional[Metadata] = None


class IngestResponse(BaseModel):
    ingested: bool
    battery_id: str


# ---------------------------------------------------------------------------
# SQS POST /api/v1/ingest (Phase 2 message format)
# ---------------------------------------------------------------------------


class MetadataV2(BaseModel):
    """Metadata block for SQS payloads — accepts any extra keys."""
    model_config = {"extra": "allow"}

    simulator_version: Optional[str] = None
    aws_region: Optional[str] = None
    queue_name: Optional[str] = None
    sqs_message_group_id: Optional[str] = None


class IngestPayloadV2(BaseModel):
    schema_version: str = Field(..., description="Data contract version (should be '2.0')")
    source: str = Field(..., description="Data source identifier")
    battery_id: str = Field(..., max_length=32)
    vehicle_id: str = Field(..., max_length=64)
    timestamp: datetime = Field(..., description="Measurement timestamp (ISO 8601)")
    sequence_id: str = Field(..., description="Unique sequence ID for ordering")
    cycle_number: int = Field(..., ge=0)
    cycle_type: str = Field(..., max_length=16, description="'charge' or 'discharge'")
    measurements: Measurements
    metadata: Optional[MetadataV2] = None


# ---------------------------------------------------------------------------
# GET /api/v1/telemetry/{battery_id}
# ---------------------------------------------------------------------------


class TelemetryReading(BaseModel):
    id: int
    recorded_at: datetime
    cycle_number: int
    cycle_type: str
    voltage_v: float
    current_a: float
    temperature_c: float
    capacity_mah: Optional[float] = None


class TelemetryResponse(BaseModel):
    battery_id: str
    total_records: int
    cursor: Optional[str] = None
    has_more: bool
    readings: list[TelemetryReading]


# ---------------------------------------------------------------------------
# GET /api/v1/soh/{battery_id}
# ---------------------------------------------------------------------------


class SoHTrendEntry(BaseModel):
    cycle: int
    soh_percent: float
    snapshot_at: datetime


class SoHTrend(BaseModel):
    direction: str  # "degrading", "stable", "improving"
    delta_last_10_cycles: float
    history: list[SoHTrendEntry]


class SoHResponse(BaseModel):
    battery_id: str
    current_soh_percent: float
    status: str  # "healthy", "warning", "critical"
    nominal_capacity_mah: float
    current_capacity_mah: float
    last_calculated_at: datetime
    trend: SoHTrend


# ---------------------------------------------------------------------------
# GET /api/v1/fleet/summary
# ---------------------------------------------------------------------------


class FleetBatteryEntry(BaseModel):
    battery_id: str
    vehicle_id: str
    current_soh_percent: Optional[float] = None
    predicted_rul_cycles: Optional[int] = None
    status: str  # "healthy", "warning", "critical", or "unknown"
    last_seen: Optional[datetime] = None


class StatusSummary(BaseModel):
    healthy: int
    warning: int
    critical: int


class FleetSummaryResponse(BaseModel):
    total_batteries: int
    status_summary: StatusSummary
    fleet_avg_soh_percent: Optional[float] = None
    batteries: list[FleetBatteryEntry]


# ---------------------------------------------------------------------------
# Week 6 Endpoints
# ---------------------------------------------------------------------------


class ConfidenceInterval(BaseModel):
    lower_bound: int
    upper_bound: int
    confidence_percent: float = 90.0


class RULResponse(BaseModel):
    battery_id: str
    predicted_rul_cycles: int
    confidence_interval: ConfidenceInterval
    current_soh_percent: float
    eol_threshold_soh: float = 70.0
    model_version: str
    predicted_at: datetime
    alert_level: str


class DegradationEntry(BaseModel):
    date: str
    avg_soh_percent: float
    min_soh_percent: float


class DegradationResponse(BaseModel):
    battery_id: str
    data: list[DegradationEntry]


# ---------------------------------------------------------------------------
# Error
# ---------------------------------------------------------------------------



class ErrorResponse(BaseModel):
    error: str
