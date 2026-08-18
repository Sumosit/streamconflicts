"""Add manual priority for ordering materials in lists."""

from alembic import op
import sqlalchemy as sa


revision = "0010_conflict_priority"
down_revision = "0009_analytics_visitors"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("conflicts", sa.Column("priority", sa.Integer(), server_default="0", nullable=False))
    op.create_index("ix_conflicts_priority", "conflicts", ["priority"])
    # Материалы, уже отмеченные как главные, получают заметный приоритет,
    # чтобы порядок на сайте не изменился сразу после обновления.
    op.execute("UPDATE conflicts SET priority = 100 WHERE is_featured = 1")


def downgrade() -> None:
    op.drop_index("ix_conflicts_priority", table_name="conflicts")
    op.drop_column("conflicts", "priority")
