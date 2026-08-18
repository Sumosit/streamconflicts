"""Initial editor schema."""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("users", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("email", sa.String(255), nullable=False), sa.Column("password_hash", sa.String(255), nullable=False), sa.Column("role", sa.String(30), nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False), sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("email"))
    op.create_index("ix_users_email", "users", ["email"])
    op.create_table("conflicts", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("slug", sa.String(180), nullable=False), sa.Column("title", sa.String(300), nullable=False), sa.Column("summary", sa.Text(), nullable=False), sa.Column("category", sa.String(100), nullable=False), sa.Column("status", sa.String(30), nullable=False), sa.Column("next_action", sa.String(300)), sa.Column("is_published", sa.Boolean(), nullable=False), sa.Column("published_at", sa.DateTime()), sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False), sa.UniqueConstraint("slug"))
    op.create_index("ix_conflicts_slug", "conflicts", ["slug"])
    op.create_index("ix_conflicts_is_published", "conflicts", ["is_published"])
    op.create_table("people", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("slug", sa.String(180), nullable=False), sa.Column("name", sa.String(180), nullable=False), sa.Column("initials", sa.String(8), nullable=False), sa.Column("avatar_url", sa.String(2000)), sa.UniqueConstraint("slug"))
    op.create_index("ix_people_slug", "people", ["slug"])
    op.create_index("ix_people_name", "people", ["name"])
    op.create_table("timeline_events", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("conflict_id", sa.Integer(), sa.ForeignKey("conflicts.id", ondelete="CASCADE"), nullable=False), sa.Column("occurred_at", sa.DateTime(), nullable=False), sa.Column("event_type", sa.String(40), nullable=False), sa.Column("title", sa.String(300), nullable=False), sa.Column("body", sa.Text(), nullable=False), sa.Column("is_commentary", sa.Boolean(), nullable=False), sa.Column("position", sa.Integer(), nullable=False), sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_timeline_events_conflict_id", "timeline_events", ["conflict_id"])
    op.create_index("ix_timeline_events_occurred_at", "timeline_events", ["occurred_at"])
    op.create_table("sources", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("event_id", sa.Integer(), sa.ForeignKey("timeline_events.id", ondelete="CASCADE"), nullable=False), sa.Column("platform", sa.String(50), nullable=False), sa.Column("url", sa.String(2000), nullable=False), sa.Column("title", sa.String(300), nullable=False), sa.Column("source_status", sa.String(40), nullable=False), sa.Column("media_type", sa.String(30), nullable=False), sa.Column("thumbnail_url", sa.String(2000)), sa.Column("duration_seconds", sa.Integer()), sa.Column("is_available", sa.Boolean(), nullable=False))
    op.create_index("ix_sources_event_id", "sources", ["event_id"])
    op.create_table("conflict_people", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("conflict_id", sa.Integer(), sa.ForeignKey("conflicts.id", ondelete="CASCADE"), nullable=False), sa.Column("person_id", sa.Integer(), sa.ForeignKey("people.id", ondelete="CASCADE"), nullable=False), sa.Column("relation", sa.String(30), nullable=False), sa.Column("role", sa.String(300)), sa.Column("event_ids", sa.JSON(), nullable=False), sa.UniqueConstraint("conflict_id", "person_id", "relation"))
    op.create_table("change_log", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("conflict_id", sa.Integer(), sa.ForeignKey("conflicts.id", ondelete="CASCADE"), nullable=False), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")), sa.Column("description", sa.String(500), nullable=False), sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_change_log_conflict_id", "change_log", ["conflict_id"])
    op.create_table("correction_requests", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("conflict_id", sa.Integer(), sa.ForeignKey("conflicts.id", ondelete="SET NULL")), sa.Column("statement", sa.Text(), nullable=False), sa.Column("source_url", sa.String(2000), nullable=False), sa.Column("contact", sa.String(300)), sa.Column("status", sa.String(30), nullable=False), sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False))
    op.create_index("ix_correction_requests_status", "correction_requests", ["status"])


def downgrade() -> None:
    for table in ["correction_requests", "change_log", "conflict_people", "sources", "timeline_events", "people", "conflicts", "users"]:
        op.drop_table(table)
