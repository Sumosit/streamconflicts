"""Add material submissions."""
from alembic import op
import sqlalchemy as sa

revision = "0002_material_submissions"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "material_submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_url", sa.String(2000), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("contact", sa.String(300), nullable=True),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_material_submissions_status", "material_submissions", ["status"])


def downgrade() -> None:
    op.drop_index("ix_material_submissions_status", table_name="material_submissions")
    op.drop_table("material_submissions")
