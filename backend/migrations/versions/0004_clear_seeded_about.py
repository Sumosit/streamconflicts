"""Clear automatically seeded About copy."""
import sqlalchemy as sa
from alembic import op

revision = "0004_clear_seeded_about"
down_revision = "0003_people_and_pages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pages = sa.table(
        "site_pages",
        sa.column("slug", sa.String()),
        sa.column("title", sa.String()),
        sa.column("lead", sa.Text()),
        sa.column("sections", sa.JSON()),
        sa.column("contact_text", sa.Text()),
        sa.column("is_published", sa.Boolean()),
    )
    op.execute(
        pages.update()
        .where(pages.c.slug == "about")
        .where(
            sa.or_(
                pages.c.title.in_(["Контекст важнее скорости", "Зачем нужен Стримархив"]),
                sa.and_(pages.c.title == "О проекте", pages.c.lead == ""),
            )
        )
        .values(title="", lead="", sections=[], contact_text=None, is_published=False)
    )


def downgrade() -> None:
    pass
