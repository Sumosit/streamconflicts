"""Add per-visitor analytics summary that survives visit cleanup."""

from alembic import op
import sqlalchemy as sa


revision = "0009_analytics_visitors"
down_revision = "0008_analytics_visits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analytics_visitors",
        sa.Column("visitor_id", sa.String(64), primary_key=True),
        sa.Column("first_seen", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("last_seen", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("visit_days", sa.Integer(), server_default="1", nullable=False),
        sa.Column("page_views", sa.Integer(), server_default="1", nullable=False),
    )
    op.create_index("ix_analytics_visitors_first_seen", "analytics_visitors", ["first_seen"])
    op.create_index("ix_analytics_visitors_last_seen", "analytics_visitors", ["last_seen"])

    # Восстанавливаем историю из уже накопленных визитов, чтобы метрики
    # «за всё время» не начинались с нуля.
    op.execute(
        """
        INSERT INTO analytics_visitors (visitor_id, first_seen, last_seen, visit_days, page_views)
        SELECT visitor_id,
               MIN(created_at),
               MAX(created_at),
               COUNT(DISTINCT date(created_at)),
               COUNT(*)
        FROM analytics_visits
        GROUP BY visitor_id
        """
    )


def downgrade() -> None:
    op.drop_table("analytics_visitors")
