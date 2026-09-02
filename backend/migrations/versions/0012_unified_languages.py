"""Add per-row language for a unified RU and EN database."""

from alembic import op
import sqlalchemy as sa


revision = "0012_unified_languages"
down_revision = "0011_priority_enabled"
branch_labels = None
depends_on = None

NAMING = {"uq": "uq_%(table_name)s_%(column_0_name)s"}


def add_language(table: str, *, replace_slug_unique: bool = False) -> None:
    with op.batch_alter_table(table, naming_convention=NAMING) as batch:
        batch.add_column(sa.Column("site_lang", sa.String(2), server_default="ru", nullable=False))
        batch.create_index(f"ix_{table}_site_lang", ["site_lang"])
        if replace_slug_unique:
            batch.drop_constraint(f"uq_{table}_slug", type_="unique")
            batch.create_unique_constraint(f"uq_{table}_site_lang_slug", ["site_lang", "slug"])


def upgrade() -> None:
    add_language("conflicts", replace_slug_unique=True)
    add_language("people", replace_slug_unique=True)
    add_language("site_pages", replace_slug_unique=True)
    add_language("material_submissions")
    add_language("correction_requests")


def remove_language(table: str, *, restore_slug_unique: bool = False) -> None:
    with op.batch_alter_table(table, naming_convention=NAMING) as batch:
        if restore_slug_unique:
            batch.drop_constraint(f"uq_{table}_site_lang_slug", type_="unique")
            batch.create_unique_constraint(f"uq_{table}_slug", ["slug"])
        batch.drop_index(f"ix_{table}_site_lang")
        batch.drop_column("site_lang")


def downgrade() -> None:
    remove_language("correction_requests")
    remove_language("material_submissions")
    remove_language("site_pages", restore_slug_unique=True)
    remove_language("people", restore_slug_unique=True)
    remove_language("conflicts", restore_slug_unique=True)
