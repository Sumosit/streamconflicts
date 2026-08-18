"""Priority applies only when explicitly enabled for a material."""

from alembic import op
import sqlalchemy as sa


revision = "0011_priority_enabled"
down_revision = "0010_conflict_priority"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("conflicts", sa.Column("priority_enabled", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.create_index("ix_conflicts_priority_enabled", "conflicts", ["priority_enabled"])
    # У кого приоритет уже проставлен — включаем флаг, чтобы порядок не изменился.
    op.execute("UPDATE conflicts SET priority_enabled = 1 WHERE priority > 0")


def downgrade() -> None:
    op.drop_index("ix_conflicts_priority_enabled", table_name="conflicts")
    op.drop_column("conflicts", "priority_enabled")
