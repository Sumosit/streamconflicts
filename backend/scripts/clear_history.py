"""Полная очистка истории стриминга.

Нужен, чтобы начать наполнение с нуля: удаляет разделы, события, переводы,
источники, изображения, пакеты исследования и сохранённые файлы импорта.
Конфликты, справочник людей и страницы сайта не трогает.

Скрипт требует явного согласия, потому что отменить его можно только
восстановлением базы из копии:

    python -m scripts.clear_history --dry-run
    python -m scripts.clear_history --yes

Файлы скачанных изображений остаются на диске: удалять их автоматически
опасно, на них могут ссылаться другие материалы.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, func, select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    HistoryCategory,
    HistoryCategoryTranslation,
    HistoryEvent,
    HistoryEventCategory,
    HistoryEventPerson,
    HistoryEventRelation,
    HistoryEventTranslation,
    HistoryImage,
    HistoryImageTranslation,
    HistoryImport,
    HistoryResearchBatch,
    HistorySource,
)

# Порядок важен: сначала зависимые таблицы, потом те, на которые они ссылаются.
TABLES = [
    ("связи событий между собой", HistoryEventRelation),
    ("связи событий с людьми", HistoryEventPerson),
    ("связи событий с разделами", HistoryEventCategory),
    ("подписи изображений", HistoryImageTranslation),
    ("изображения", HistoryImage),
    ("источники", HistorySource),
    ("переводы событий", HistoryEventTranslation),
    ("события", HistoryEvent),
    ("пакеты исследования", HistoryResearchBatch),
    ("загруженные файлы импорта", HistoryImport),
    ("названия разделов", HistoryCategoryTranslation),
    ("разделы", HistoryCategory),
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--yes", action="store_true", help="Подтвердить удаление")
    parser.add_argument("--dry-run", action="store_true", help="Только показать, что будет удалено")
    args = parser.parse_args()

    with SessionLocal() as db:
        counts = [(label, db.scalar(select(func.count()).select_from(model)) or 0)
                  for label, model in TABLES]
        total = sum(count for _, count in counts)

        print("Будет удалено:")
        for label, count in counts:
            print(f"  {label}: {count}")
        print(f"Всего строк: {total}")

        if args.dry_run:
            print("\nРежим проверки, ничего не изменено.")
            return
        if not args.yes:
            print("\nНичего не удалено. Для удаления добавьте --yes")
            return
        if total == 0:
            print("\nУдалять нечего.")
            return

        for _, model in TABLES:
            db.execute(delete(model))
        db.commit()
        print("\nИстория очищена. Разделы создаются заново в /editor/history/categories.")


if __name__ == "__main__":
    main()
