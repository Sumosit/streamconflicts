"""Rebuild unified analytics tables from the original RU and EN databases."""

from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path


TABLES = ("analytics_visits", "analytics_visitors")


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


def columns(connection: sqlite3.Connection, table: str) -> list[str]:
    return [row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')]


def count(connection: sqlite3.Connection, table: str) -> int:
    return int(connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0])


def import_table(
    target: sqlite3.Connection,
    source: sqlite3.Connection,
    table: str,
    language: str,
) -> None:
    source_columns = columns(source, table)
    target_columns = columns(target, table)
    copied_columns = [name for name in source_columns if name != "id" and name in target_columns]
    for row in source.execute(f'SELECT * FROM "{table}"'):
        values = {name: row[name] for name in copied_columns}
        values["site_lang"] = language
        old_visitor = str(row["visitor_id"])
        values["visitor_id"] = (
            old_visitor if old_visitor.startswith(("ru:", "en:")) else f"{language}:{old_visitor}"
        )
        names = list(values)
        placeholders = ", ".join("?" for _ in names)
        quoted = ", ".join(f'"{name}"' for name in names)
        target.execute(
            f'INSERT INTO "{table}" ({quoted}) VALUES ({placeholders})',
            [values[name] for name in names],
        )


def main() -> None:
    args = arguments()
    ru = connect(args.ru)
    en = connect(args.en)
    merged = connect(args.merged)
    expected = {table: count(ru, table) + count(en, table) for table in TABLES}
    try:
        merged.execute("BEGIN IMMEDIATE")
        merged.execute("DELETE FROM analytics_visits")
        merged.execute("DELETE FROM analytics_visitors")
        for language, source in (("ru", ru), ("en", en)):
            import_table(merged, source, "analytics_visits", language)
            import_table(merged, source, "analytics_visitors", language)
        for table in TABLES:
            actual = count(merged, table)
            print(f"{table}: expected={expected[table]} actual={actual}")
            if actual != expected[table]:
                raise RuntimeError(f"Incorrect {table} count")
            distribution = list(merged.execute(
                f'SELECT site_lang, COUNT(*) FROM "{table}" GROUP BY site_lang ORDER BY site_lang'
            ))
            print(f"{table} languages: {[tuple(row) for row in distribution]}")
        integrity = merged.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"Integrity check failed: {integrity}")
        merged.commit()
        print("Analytics repair passed")
    except Exception:
        merged.rollback()
        raise
    finally:
        ru.close()
        en.close()
        merged.close()


if __name__ == "__main__":
    main()
