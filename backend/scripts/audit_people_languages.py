"""Аудит справочника людей перед объединением RU и EN в одну запись.

Скрипт ничего не меняет: только читает и считает. Нужен, чтобы до миграции
понимать масштаб — сколько людей задвоено, сколько пар определяется надёжно
(slug, ссылка на профиль), а сколько только по имени, где риск склеить разных
людей с одинаковым ником.

Запуск по копии боевой базы, не по самой базе:

    python -m scripts.audit_people_languages --database backups/pre-update.sqlite3
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

CYRILLIC = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e",
    "ю": "yu", "я": "ya",
}


def normalize(value: str) -> str:
    """Приводит имя к сравнимому виду: регистр, пробелы, кириллица."""
    lowered = (value or "").lower()
    return "".join(CYRILLIC.get(char, char) for char in lowered if char.isalnum() or char in CYRILLIC)


def handles(links_json: str | None) -> set[str]:
    """Ники из ссылок на профили — самый надёжный признак после slug."""
    try:
        links = json.loads(links_json or "{}")
    except (TypeError, ValueError):
        return set()
    result = set()
    for value in (links or {}).values():
        if not value:
            continue
        tail = str(value).rstrip("/").rsplit("/", 1)[-1].lower().lstrip("@")
        if tail and "." not in tail:
            result.add(tail)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True, help="Путь к копии базы (не к рабочему файлу)")
    parser.add_argument("--show", type=int, default=15, help="Сколько примеров печатать в каждой группе")
    args = parser.parse_args()

    path = Path(args.database)
    if not path.exists():
        raise SystemExit(f"Файл не найден: {path}")

    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row

    # Аудит должен работать и до миграции 0014, которая заводит canonical_key
    # и таблицы истории: смысл скрипта в том, чтобы посмотреть на базу заранее.
    columns = {row["name"] for row in connection.execute("PRAGMA table_info(people)")}
    has_key = "canonical_key" in columns
    key_column = "canonical_key" if has_key else "NULL AS canonical_key"
    people = connection.execute(
        f"SELECT id, site_lang, slug, name, links, {key_column}, entity_type, profile_status FROM people"
    ).fetchall()
    usage = dict(connection.execute(
        "SELECT person_id, COUNT(*) FROM conflict_people GROUP BY person_id"
    ).fetchall())
    history_usage = {}
    try:
        history_usage = dict(connection.execute(
            "SELECT person_id, COUNT(*) FROM history_event_people GROUP BY person_id"
        ).fetchall())
    except sqlite3.OperationalError:
        pass  # база ещё без миграции 0014
    connection.close()

    by_language: dict[str, int] = defaultdict(int)
    for person in people:
        by_language[person["site_lang"]] += 1

    print("=" * 64)
    print("СПРАВОЧНИК")
    print("=" * 64)
    print(f"Всего записей: {len(people)}")
    for language, count in sorted(by_language.items()):
        print(f"  {language}: {count}")
    if has_key:
        already = [p for p in people if p["canonical_key"]]
        print(f"Уже связаны ключом: {len(already)}")
    else:
        print("Уже связаны ключом: колонки ещё нет (база до миграции 0014)")
    print(f"Упоминаются в конфликтах: {len(usage)}")
    if history_usage:
        print(f"Упоминаются в истории: {len(history_usage)}")

    # Группируем по трём признакам, каждая пара попадает в самую надёжную группу.
    groups: dict[str, dict[str, list[sqlite3.Row]]] = {"slug": defaultdict(list), "handle": defaultdict(list), "name": defaultdict(list)}
    for person in people:
        groups["slug"][person["slug"].lower()].append(person)
        groups["name"][normalize(person["name"])].append(person)
        for handle in handles(person["links"]):
            groups["handle"][handle].append(person)

    seen: set[tuple[int, ...]] = set()
    report: dict[str, list[tuple[str, list[sqlite3.Row]]]] = {}
    labels = {"slug": "совпадает slug", "handle": "совпадает ссылка на профиль", "name": "совпадает только имя"}
    for kind in ("slug", "handle", "name"):
        rows = []
        for value, members in groups[kind].items():
            if len({person["site_lang"] for person in members}) < 2:
                continue
            identity = tuple(sorted(person["id"] for person in members))
            if identity in seen:
                continue
            seen.add(identity)
            rows.append((value, members))
        report[kind] = sorted(rows, key=lambda item: item[0])

    print()
    print("=" * 64)
    print("МЕЖЪЯЗЫКОВЫЕ ПАРЫ")
    print("=" * 64)
    total_pairs = sum(len(rows) for rows in report.values())
    for kind in ("slug", "handle", "name"):
        rows = report[kind]
        print(f"\n{labels[kind]}: {len(rows)}")
        for value, members in rows[: args.show]:
            names = " | ".join(
                f"{person['site_lang'].upper()} #{person['id']} {person['name']} ({person['slug']})"
                for person in members
            )
            mentions = sum(usage.get(person["id"], 0) for person in members)
            print(f"  {value}: {names} — упоминаний {mentions}")
        if len(rows) > args.show:
            print(f"  ... ещё {len(rows) - args.show}")

    # Дубли внутри одного языка — это другая задача: их сливают, а не связывают.
    same_language = []
    for value, members in groups["name"].items():
        per_language: dict[str, list[sqlite3.Row]] = defaultdict(list)
        for person in members:
            per_language[person["site_lang"]].append(person)
        for language, rows in per_language.items():
            if len(rows) > 1:
                same_language.append((language, value, rows))

    print()
    print("=" * 64)
    print("ИТОГ")
    print("=" * 64)
    print(f"Пар для связывания: {total_pairs}")
    print(f"  из них надёжных (slug или ссылка): {len(report['slug']) + len(report['handle'])}")
    print(f"  требуют ручной проверки (только имя): {len(report['name'])}")
    print(f"Дублей внутри одного языка (сливать, а не связывать): {len(same_language)}")
    for language, value, rows in same_language[: args.show]:
        print(f"  {language}: {value} — " + ", ".join(f"#{person['id']} {person['slug']}" for person in rows))

    unpaired = len(people) - sum(len(members) for rows in report.values() for _, members in rows)
    print(f"Записей без межъязыковой пары: {unpaired}")
    print()
    print("Скрипт ничего не изменил. Пары связываются вручную в /editor/people.")


if __name__ == "__main__":
    main()
