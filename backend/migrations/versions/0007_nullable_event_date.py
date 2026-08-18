"""Allow timeline events without an established date."""

from alembic import op
import sqlalchemy as sa


revision = "0007_nullable_event_date"
down_revision = "0006_person_entity_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("timeline_events") as batch_op:
        batch_op.alter_column("occurred_at", existing_type=sa.DateTime(), nullable=True)


def downgrade() -> None:
    op.execute("DELETE FROM timeline_events WHERE occurred_at IS NULL")
    with op.batch_alter_table("timeline_events") as batch_op:
        batch_op.alter_column("occurred_at", existing_type=sa.DateTime(), nullable=False)
