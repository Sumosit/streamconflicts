"""Streaming history: language-neutral events with RU/EN translations."""

from alembic import op
import sqlalchemy as sa


revision = "0014_history"
down_revision = "0013_analytics_language"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Связка RU- и EN-карточек одного человека: таблица people языковая,
    # а история общая, поэтому нужен ключ поверх site_lang.
    with op.batch_alter_table("people") as batch:
        batch.add_column(sa.Column("canonical_key", sa.String(180), nullable=True))
        batch.create_index("ix_people_canonical_key", ["canonical_key"])

    op.create_table(
        "history_categories",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("parent_id", sa.Integer, sa.ForeignKey("history_categories.id", ondelete="CASCADE"), nullable=True),
        sa.Column("slug", sa.String(180), nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_platform", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("icon", sa.String(80), nullable=True),
        sa.Column("is_published", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_history_categories_parent_id", "history_categories", ["parent_id"])
    op.create_index("ix_history_categories_slug", "history_categories", ["slug"], unique=True)
    op.create_index("ix_history_categories_is_platform", "history_categories", ["is_platform"])
    op.create_index("ix_history_categories_is_published", "history_categories", ["is_published"])

    op.create_table(
        "history_category_translations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("history_categories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("language", sa.String(2), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.UniqueConstraint("category_id", "language", name="uq_history_category_translations_category_id"),
    )
    op.create_index("ix_history_category_translations_category_id", "history_category_translations", ["category_id"])
    op.create_index("ix_history_category_translations_language", "history_category_translations", ["language"])

    op.create_table(
        "history_events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("slug", sa.String(180), nullable=False),
        sa.Column("external_id", sa.String(180), nullable=True),
        sa.Column("date_start", sa.Date, nullable=True),
        sa.Column("date_end", sa.Date, nullable=True),
        sa.Column("date_precision", sa.String(20), nullable=False, server_default="day"),
        sa.Column("sort_date", sa.Date, nullable=True),
        sa.Column("year", sa.Integer, nullable=True),
        sa.Column("region", sa.String(20), nullable=False, server_default="global"),
        sa.Column("importance", sa.Integer, nullable=False, server_default="50"),
        sa.Column("confidence", sa.Integer, nullable=False, server_default="100"),
        sa.Column("needs_verification", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("is_published", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("cover_image_url", sa.String(2000), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_history_events_slug", "history_events", ["slug"], unique=True)
    op.create_index("ix_history_events_external_id", "history_events", ["external_id"])
    op.create_index("ix_history_events_sort_date", "history_events", ["sort_date"])
    op.create_index("ix_history_events_year", "history_events", ["year"])
    op.create_index("ix_history_events_region", "history_events", ["region"])
    op.create_index("ix_history_events_importance", "history_events", ["importance"])
    op.create_index("ix_history_events_needs_verification", "history_events", ["needs_verification"])
    op.create_index("ix_history_events_status", "history_events", ["status"])
    op.create_index("ix_history_events_is_published", "history_events", ["is_published"])

    op.create_table(
        "history_event_translations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("event_id", sa.Integer, sa.ForeignKey("history_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("language", sa.String(2), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("summary", sa.Text, nullable=False, server_default=""),
        sa.Column("content", sa.Text, nullable=False, server_default=""),
        sa.Column("historical_context", sa.Text, nullable=False, server_default=""),
        sa.Column("consequences", sa.Text, nullable=False, server_default=""),
        sa.Column("translation_status", sa.String(20), nullable=False, server_default="draft"),
        sa.UniqueConstraint("event_id", "language", name="uq_history_event_translations_event_id"),
    )
    op.create_index("ix_history_event_translations_event_id", "history_event_translations", ["event_id"])
    op.create_index("ix_history_event_translations_language", "history_event_translations", ["language"])

    op.create_table(
        "history_event_categories",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("event_id", sa.Integer, sa.ForeignKey("history_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("history_categories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_primary", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("event_id", "category_id", name="uq_history_event_categories_event_id"),
    )
    op.create_index("ix_history_event_categories_event_id", "history_event_categories", ["event_id"])
    op.create_index("ix_history_event_categories_category_id", "history_event_categories", ["category_id"])

    op.create_table(
        "history_sources",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("event_id", sa.Integer, sa.ForeignKey("history_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(2000), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("publisher", sa.String(200), nullable=True),
        sa.Column("published_at", sa.Date, nullable=True),
        sa.Column("language", sa.String(5), nullable=True),
        sa.Column("source_status", sa.String(40), nullable=False, server_default="primary"),
        sa.Column("is_available", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_history_sources_event_id", "history_sources", ["event_id"])

    op.create_table(
        "history_images",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("event_id", sa.Integer, sa.ForeignKey("history_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_url", sa.String(2000), nullable=True),
        sa.Column("source_url", sa.String(2000), nullable=True),
        sa.Column("author", sa.String(200), nullable=True),
        sa.Column("license", sa.String(120), nullable=True),
        sa.Column("taken_at", sa.Date, nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_cover", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("review_status", sa.String(20), nullable=False, server_default="candidate"),
    )
    op.create_index("ix_history_images_event_id", "history_images", ["event_id"])
    op.create_index("ix_history_images_review_status", "history_images", ["review_status"])

    op.create_table(
        "history_image_translations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("image_id", sa.Integer, sa.ForeignKey("history_images.id", ondelete="CASCADE"), nullable=False),
        sa.Column("language", sa.String(2), nullable=False),
        sa.Column("caption", sa.Text, nullable=True),
        sa.Column("alt_text", sa.String(500), nullable=True),
        sa.UniqueConstraint("image_id", "language", name="uq_history_image_translations_image_id"),
    )
    op.create_index("ix_history_image_translations_image_id", "history_image_translations", ["image_id"])
    op.create_index("ix_history_image_translations_language", "history_image_translations", ["language"])

    op.create_table(
        "history_event_people",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("event_id", sa.Integer, sa.ForeignKey("history_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("person_id", sa.Integer, sa.ForeignKey("people.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relation", sa.String(30), nullable=False, server_default="participant"),
        sa.Column("role", sa.String(300), nullable=True),
        sa.UniqueConstraint("event_id", "person_id", "relation", name="uq_history_event_people_event_id"),
    )
    op.create_index("ix_history_event_people_event_id", "history_event_people", ["event_id"])
    op.create_index("ix_history_event_people_person_id", "history_event_people", ["person_id"])

    op.create_table(
        "history_event_relations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("event_id", sa.Integer, sa.ForeignKey("history_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("related_event_id", sa.Integer, sa.ForeignKey("history_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relation_type", sa.String(30), nullable=False, server_default="related"),
        sa.UniqueConstraint("event_id", "related_event_id", name="uq_history_event_relations_event_id"),
    )
    op.create_index("ix_history_event_relations_event_id", "history_event_relations", ["event_id"])
    op.create_index("ix_history_event_relations_related_event_id", "history_event_relations", ["related_event_id"])

    op.create_table(
        "history_imports",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("filename", sa.String(300), nullable=True),
        sa.Column("mode", sa.String(30), nullable=False, server_default="preview"),
        sa.Column("status", sa.String(20), nullable=False, server_default="preview"),
        sa.Column("raw_json", sa.Text, nullable=False),
        sa.Column("stats", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "history_research_batches",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("period_start", sa.Date, nullable=True),
        sa.Column("period_end", sa.Date, nullable=True),
        sa.Column("region", sa.String(20), nullable=False, server_default="global"),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("history_categories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="planned"),
        sa.Column("prompt_version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("import_id", sa.Integer, sa.ForeignKey("history_imports.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_history_research_batches_region", "history_research_batches", ["region"])
    op.create_index("ix_history_research_batches_category_id", "history_research_batches", ["category_id"])
    op.create_index("ix_history_research_batches_status", "history_research_batches", ["status"])


def downgrade() -> None:
    for table in (
        "history_research_batches",
        "history_imports",
        "history_event_relations",
        "history_event_people",
        "history_image_translations",
        "history_images",
        "history_sources",
        "history_event_categories",
        "history_event_translations",
        "history_events",
        "history_category_translations",
        "history_categories",
    ):
        op.drop_table(table)
    with op.batch_alter_table("people") as batch:
        batch.drop_index("ix_people_canonical_key")
        batch.drop_column("canonical_key")
