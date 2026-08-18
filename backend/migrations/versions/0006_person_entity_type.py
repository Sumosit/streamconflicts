"""Add person entity type."""
from alembic import op
import sqlalchemy as sa

revision = "0006_person_entity_type"
down_revision = "0005_conflict_cover"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("people") as batch:
        batch.add_column(sa.Column("entity_type", sa.String(30), nullable=False, server_default="streamer"))
        batch.create_index("ix_people_entity_type", ["entity_type"])


def downgrade() -> None:
    with op.batch_alter_table("people") as batch:
        batch.drop_index("ix_people_entity_type")
        batch.drop_column("entity_type")
