from contextvars import ContextVar

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker, with_loader_criteria

from app.config import get_settings

settings = get_settings()
current_site_lang: ContextVar[str] = ContextVar("current_site_lang", default=settings.site_lang)
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False, "timeout": 30},
)


@event.listens_for(engine, "connect")
def configure_sqlite(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.close()
    # LIKE в SQLite игнорирует регистр только для латиницы, поэтому поиск по
    # русским заголовкам без своей функции не находит «Партнёрская» по «партнёрская».
    dbapi_connection.create_function("py_lower", 1, lambda value: value.lower() if isinstance(value, str) else value)


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


@event.listens_for(Session, "do_orm_execute")
def filter_localized_queries(execute_state) -> None:
    if not execute_state.is_select or execute_state.execution_options.get("include_all_languages"):
        return
    from app.models import AnalyticsVisit, AnalyticsVisitor, Conflict, CorrectionRequest, MaterialSubmission, Person, SitePage

    language = current_site_lang.get()
    if language == "all":
        return
    for model in (AnalyticsVisit, AnalyticsVisitor, Conflict, CorrectionRequest, MaterialSubmission, Person, SitePage):
        execute_state.statement = execute_state.statement.options(
            with_loader_criteria(model, model.site_lang == language, include_aliases=True)
        )


@event.listens_for(Session, "before_flush")
def assign_language_to_new_rows(session, _flush_context, _instances) -> None:
    from app.models import AnalyticsVisit, AnalyticsVisitor, Conflict, CorrectionRequest, MaterialSubmission, Person, SitePage

    language = current_site_lang.get()
    for item in session.new:
        if isinstance(item, (AnalyticsVisit, AnalyticsVisitor, Conflict, CorrectionRequest, MaterialSubmission, Person, SitePage)):
            item.site_lang = language


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
