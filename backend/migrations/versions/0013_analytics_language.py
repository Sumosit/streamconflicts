"""Split analytics between RU and EN within the unified database."""

from alembic import op
import sqlalchemy as sa


revision = "0013_analytics_language"
down_revision = "0012_unified_languages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("analytics_visits") as batch:
        batch.add_column(sa.Column("site_lang", sa.String(2), server_default="ru", nullable=False))
        batch.create_index("ix_analytics_visits_site_lang", ["site_lang"])
    with op.batch_alter_table("analytics_visitors") as batch:
        batch.add_column(sa.Column("site_lang", sa.String(2), server_default="ru", nullable=False))
        batch.create_index("ix_analytics_visitors_site_lang", ["site_lang"])

    op.execute("UPDATE analytics_visits SET site_lang='en' WHERE path='/en' OR path LIKE '/en/%'")
    op.execute(
        "UPDATE analytics_visits SET visitor_id=site_lang || ':' || visitor_id "
        "WHERE visitor_id NOT LIKE 'ru:%' AND visitor_id NOT LIKE 'en:%'"
    )
    # analytics_visits хранит 90 дней и является точной базой для разделения.
    # Старую объединенную сводку нельзя корректно разрезать, поэтому пересобираем её.
    op.execute("DELETE FROM analytics_visitors")
    op.execute(
        """INSERT INTO analytics_visitors
           (visitor_id, site_lang, first_seen, last_seen, visit_days, page_views)
           SELECT visitor_id, site_lang, MIN(created_at), MAX(created_at),
                  COUNT(DISTINCT date(created_at)), COUNT(*)
           FROM analytics_visits
           GROUP BY site_lang, visitor_id"""
    )


def downgrade() -> None:
    op.execute(
        "UPDATE analytics_visits SET visitor_id=substr(visitor_id, 4) "
        "WHERE visitor_id LIKE 'ru:%' OR visitor_id LIKE 'en:%'"
    )
    with op.batch_alter_table("analytics_visitors") as batch:
        batch.drop_index("ix_analytics_visitors_site_lang")
        batch.drop_column("site_lang")
    with op.batch_alter_table("analytics_visits") as batch:
        batch.drop_index("ix_analytics_visits_site_lang")
        batch.drop_column("site_lang")
