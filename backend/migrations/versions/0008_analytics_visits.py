"""Add first-party visit analytics."""

from alembic import op
import sqlalchemy as sa


revision = "0008_analytics_visits"
down_revision = "0007_nullable_event_date"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analytics_visits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("visitor_id", sa.String(64), nullable=False),
        sa.Column("ip_address", sa.String(64), nullable=False),
        sa.Column("path", sa.String(500), nullable=False),
        sa.Column("referrer", sa.String(2000), nullable=True),
        sa.Column("user_agent", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_analytics_visits_visitor_id", "analytics_visits", ["visitor_id"])
    op.create_index("ix_analytics_visits_ip_address", "analytics_visits", ["ip_address"])
    op.create_index("ix_analytics_visits_path", "analytics_visits", ["path"])
    op.create_index("ix_analytics_visits_created_at", "analytics_visits", ["created_at"])


def downgrade() -> None:
    op.drop_table("analytics_visits")
