"""Add conflict cover image."""
from alembic import op
import sqlalchemy as sa

revision = "0005_conflict_cover"
down_revision = "0004_clear_seeded_about"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("conflicts") as batch:
        batch.add_column(sa.Column("cover_image_url", sa.String(2000), nullable=True))
        batch.add_column(sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.create_index("ix_conflicts_is_featured", ["is_featured"])


def downgrade() -> None:
    with op.batch_alter_table("conflicts") as batch:
        batch.drop_index("ix_conflicts_is_featured")
        batch.drop_column("is_featured")
        batch.drop_column("cover_image_url")
