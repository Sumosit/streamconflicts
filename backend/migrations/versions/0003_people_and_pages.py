"""Expand people and add editable pages."""
from alembic import op
import sqlalchemy as sa

revision = "0003_people_and_pages"
down_revision = "0002_material_submissions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("people") as batch:
        batch.add_column(sa.Column("bio", sa.Text(), nullable=True))
        batch.add_column(sa.Column("links", sa.JSON(), nullable=False, server_default="{}"))
        batch.add_column(sa.Column("profile_status", sa.String(30), nullable=False, server_default="active"))
    op.create_table(
        "site_pages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("lead", sa.Text(), nullable=False),
        sa.Column("sections", sa.JSON(), nullable=False),
        sa.Column("contact_text", sa.Text(), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_site_pages_slug", "site_pages", ["slug"])


def downgrade() -> None:
    op.drop_index("ix_site_pages_slug", table_name="site_pages")
    op.drop_table("site_pages")
    with op.batch_alter_table("people") as batch:
        batch.drop_column("profile_status")
        batch.drop_column("links")
        batch.drop_column("bio")
