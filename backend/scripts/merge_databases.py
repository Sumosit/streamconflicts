"""Merge separate RU and EN StreamArchive SQLite databases into a new file."""

from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))
os.environ.setdefault("JWT_SECRET", "merge-script-not-used")
os.environ.setdefault("BOOTSTRAP_ADMIN_EMAIL", "merge-script@example.invalid")
os.environ.setdefault("BOOTSTRAP_ADMIN_PASSWORD", "merge-script-not-used")

from sqlalchemy import create_engine  # noqa: E402

from app.database import Base  # noqa: E402
from app import models  # noqa: F401,E402


LANG_TABLES = {
    "analytics_visits",
    "analytics_visitors",
    "conflicts",
    "people",
    "site_pages",
    "material_submissions",
    "correction_requests",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ru", required=True, type=Path)
    parser.add_argument("--en", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def open_source(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise SystemExit(f"Source database not found: {path}")
    uri = f"file:{path.resolve().as_posix()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        raise SystemExit(f"Integrity check failed for {path}: {integrity}")
    return connection


def rows(connection: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    exists = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    return list(connection.execute(f'SELECT * FROM "{table}"')) if exists else []


def target_columns(connection: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')}


def insert(connection: sqlite3.Connection, table: str, values: dict[str, Any]) -> int:
    allowed = target_columns(connection, table)
    clean = {key: value for key, value in values.items() if key in allowed}
    columns = ", ".join(f'"{key}"' for key in clean)
    placeholders = ", ".join("?" for _ in clean)
    cursor = connection.execute(
        f'INSERT INTO "{table}" ({columns}) VALUES ({placeholders})', tuple(clean.values())
    )
    return int(cursor.lastrowid)


def without_id(row: sqlite3.Row, *, language: str | None = None) -> dict[str, Any]:
    values = {key: row[key] for key in row.keys() if key != "id"}
    if language is not None:
        values["site_lang"] = language
    return values


def import_users(target: sqlite3.Connection, sources: list[tuple[str, sqlite3.Connection]]) -> dict[tuple[str, int], int]:
    mapping: dict[tuple[str, int], int] = {}
    by_email: dict[str, int] = {}
    for language, source in sources:
        for row in rows(source, "users"):
            email = str(row["email"]).lower()
            target_id = by_email.get(email)
            if target_id is None:
                target_id = insert(target, "users", without_id(row))
                by_email[email] = target_id
            mapping[(language, row["id"])] = target_id
    return mapping


def import_simple_entities(
    target: sqlite3.Connection,
    sources: list[tuple[str, sqlite3.Connection]],
    table: str,
) -> dict[tuple[str, int], int]:
    mapping: dict[tuple[str, int], int] = {}
    for language, source in sources:
        for row in rows(source, table):
            target_id = insert(target, table, without_id(row, language=language if table in LANG_TABLES else None))
            mapping[(language, row["id"])] = target_id
    return mapping


def import_visitors(target: sqlite3.Connection, sources: list[tuple[str, sqlite3.Connection]]) -> None:
    for language, source in sources:
        for row in rows(source, "analytics_visitors"):
            values = dict(row)
            old_visitor = str(row["visitor_id"])
            values["visitor_id"] = old_visitor if old_visitor.startswith(("ru:", "en:")) else f"{language}:{old_visitor}"
            values["site_lang"] = language
            insert(target, "analytics_visitors", values)


def merge(ru: sqlite3.Connection, en: sqlite3.Connection, output: Path) -> None:
    if output.exists():
        raise SystemExit(f"Output already exists, refusing to overwrite: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{output.resolve().as_posix()}")
    Base.metadata.create_all(engine)
    engine.dispose()

    target = sqlite3.connect(output)
    target.row_factory = sqlite3.Row
    target.execute("PRAGMA foreign_keys=ON")
    sources = [("ru", ru), ("en", en)]
    try:
        target.execute("BEGIN")
        user_ids = import_users(target, sources)
        person_ids = import_simple_entities(target, sources, "people")
        conflict_ids = import_simple_entities(target, sources, "conflicts")

        event_ids: dict[tuple[str, int], int] = {}
        for language, source in sources:
            for row in rows(source, "timeline_events"):
                values = without_id(row)
                values["conflict_id"] = conflict_ids[(language, row["conflict_id"])]
                event_ids[(language, row["id"])] = insert(target, "timeline_events", values)

        for language, source in sources:
            for row in rows(source, "sources"):
                values = without_id(row)
                values["event_id"] = event_ids[(language, row["event_id"])]
                insert(target, "sources", values)

            for row in rows(source, "conflict_people"):
                values = without_id(row)
                values["conflict_id"] = conflict_ids[(language, row["conflict_id"])]
                values["person_id"] = person_ids[(language, row["person_id"])]
                insert(target, "conflict_people", values)

            for row in rows(source, "change_log"):
                values = without_id(row)
                values["conflict_id"] = conflict_ids[(language, row["conflict_id"])]
                old_user = row["user_id"]
                values["user_id"] = user_ids.get((language, old_user)) if old_user is not None else None
                insert(target, "change_log", values)

            for row in rows(source, "correction_requests"):
                values = without_id(row, language=language)
                old_conflict = row["conflict_id"]
                values["conflict_id"] = conflict_ids.get((language, old_conflict)) if old_conflict is not None else None
                insert(target, "correction_requests", values)

            for table in ("material_submissions", "site_pages"):
                for row in rows(source, table):
                    insert(target, table, without_id(row, language=language))

            for row in rows(source, "analytics_visits"):
                values = without_id(row, language=language)
                old_visitor = str(row["visitor_id"])
                values["visitor_id"] = old_visitor if old_visitor.startswith(("ru:", "en:")) else f"{language}:{old_visitor}"
                insert(target, "analytics_visits", values)

        import_visitors(target, sources)
        target.execute("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)")
        target.execute("DELETE FROM alembic_version")
        target.execute("INSERT INTO alembic_version(version_num) VALUES (?)", ("0013_analytics_language",))
        violations = list(target.execute("PRAGMA foreign_key_check"))
        if violations:
            raise RuntimeError(f"Foreign key violations: {violations[:10]}")
        target.commit()
    except Exception:
        target.rollback()
        target.close()
        output.unlink(missing_ok=True)
        raise
    target.close()


def main() -> None:
    args = parse_args()
    ru = open_source(args.ru)
    en = open_source(args.en)
    try:
        merge(ru, en, args.output)
    finally:
        ru.close()
        en.close()
    print(f"Merged database created: {args.output}")


if __name__ == "__main__":
    main()
