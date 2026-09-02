"""Verify counts, languages and foreign keys after a database merge."""

from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path


COUNT_TABLES = (
    "conflicts",
    "people",
    "timeline_events",
    "sources",
    "conflict_people",
    "change_log",
    "correction_requests",
    "material_submissions",
    "site_pages",
    "analytics_visits",
    "analytics_visitors",
)
LANG_TABLES = (
    "analytics_visits",
    "analytics_visitors",
    "conflicts",
    "people",
    "correction_requests",
    "material_submissions",
    "site_pages",
)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ru", required=True, type=Path)
    parser.add_argument("--en", required=True, type=Path)
    parser.add_argument("--merged", required=True, type=Path)
    return parser.parse_args()


def connect(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise SystemExit(f"Database not found: {path}")
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    return connection


def count(connection: sqlite3.Connection, table: str, where: str = "", params: tuple = ()) -> int:
    exists = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    if not exists:
        return 0
    return int(connection.execute(f'SELECT COUNT(*) FROM "{table}" {where}', params).fetchone()[0])


def main() -> None:
    args = arguments()
    ru, en, merged = connect(args.ru), connect(args.en), connect(args.merged)
    errors: list[str] = []
    try:
        integrity = merged.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            errors.append(f"integrity_check: {integrity}")
        foreign_keys = list(merged.execute("PRAGMA foreign_key_check"))
        if foreign_keys:
            errors.append(f"foreign_key_check: {foreign_keys[:10]}")

        for table in COUNT_TABLES:
            expected = count(ru, table) + count(en, table)
            actual = count(merged, table)
            print(f"{table}: expected={expected} actual={actual}")
            if actual != expected:
                errors.append(f"{table}: expected {expected}, got {actual}")

        for table in LANG_TABLES:
            expected_ru, expected_en = count(ru, table), count(en, table)
            actual_ru = count(merged, table, "WHERE site_lang=?", ("ru",))
            actual_en = count(merged, table, "WHERE site_lang=?", ("en",))
            print(f"{table} languages: ru={actual_ru}/{expected_ru} en={actual_en}/{expected_en}")
            if (actual_ru, actual_en) != (expected_ru, expected_en):
                errors.append(f"{table}: incorrect language distribution")

        duplicate_users = list(merged.execute(
            "SELECT lower(email), COUNT(*) FROM users GROUP BY lower(email) HAVING COUNT(*) > 1"
        ))
        if duplicate_users:
            errors.append(f"duplicate users: {duplicate_users}")
    finally:
        ru.close()
        en.close()
        merged.close()

    if errors:
        print("Verification failed:")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)
    print("Verification passed")


if __name__ == "__main__":
    main()
