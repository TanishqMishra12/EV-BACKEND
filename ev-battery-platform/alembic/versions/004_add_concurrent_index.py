"""add_concurrent_index

Revision ID: 004
Revises: 003
Create Date: 2026-06-13 16:32:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Enable non-transactional DDL execution for Postgres CONCURRENTLY index operations
disable_ddl_transaction = True


def upgrade() -> None:
    # Drop the old index concurrently to prevent table locking
    op.drop_index(
        "ix_telemetry_battery_recorded",
        table_name="telemetry",
        postgresql_concurrently=True,
    )
    # Create the new index concurrently
    op.create_index(
        "idx_telemetry_battery_recorded",
        "telemetry",
        ["battery_id", sa.text("recorded_at DESC")],
        postgresql_concurrently=True,
    )


def downgrade() -> None:
    # Drop the new index concurrently
    op.drop_index(
        "idx_telemetry_battery_recorded",
        table_name="telemetry",
        postgresql_concurrently=True,
    )
    # Recreate the old index concurrently
    op.create_index(
        "ix_telemetry_battery_recorded",
        "telemetry",
        ["battery_id", sa.text("recorded_at DESC")],
        postgresql_concurrently=True,
    )
