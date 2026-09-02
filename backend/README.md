# StreamArchive backend

FastAPI API обслуживает русскую и английскую версии сайта из одной базы.

## Среды

| Среда | API | SQLite | Изображения |
|---|---:|---|---|
| dev | `127.0.0.1:8001` | `server-data/dev/data/streamconflicts-dev.sqlite3` | `server-data/dev/uploads` |
| prod RU и EN | `127.0.0.1:8002` | `server-data/unified/data/streamconflicts.sqlite3` | `server-data/unified/uploads` |

Production API один. Nginx передаёт `X-Site-Lang: ru` для `/api` и
`X-Site-Lang: en` для `/en/api`.

## Основные маршруты

- `POST /api/auth/token`: вход в редактор.
- `GET /api/conflicts`: опубликованные материалы текущего языка.
- `GET /api/conflicts/{slug}`: материал текущего языка.
- `GET /api/admin/conflicts`: материалы редактора текущего языка.
- `POST /api/admin/conflicts`: создание материала.
- `PATCH /api/admin/conflicts/{id}`: изменение материала.
- `POST /api/admin/uploads/images`: загрузка изображения.
- `POST /api/analytics/visit`: запись посещения текущего языка.
- `GET /api/admin/analytics?days=30&site_lang=ru`: RU-аналитика.
- `GET /api/admin/analytics?days=30&site_lang=en`: EN-аналитика.
- `GET /api/admin/analytics?days=30&site_lang=all`: общая аналитика.
- `GET /docs`: OpenAPI.

## Миграции и служебные скрипты

Актуальная миграция: `0013_analytics_language`.

```text
scripts/merge_databases.py
scripts/verify_merged_database.py
scripts/repair_analytics_languages.py
```

Назначение и фактическое состояние production описаны в `PROJECT_STATE.md`.

## Резервная копия

Копировать работающий SQLite-файл напрямую нельзя. Используется SQLite backup API:

```bash
docker compose exec api-prod python -c "import sqlite3; s=sqlite3.connect('/data/streamconflicts.sqlite3'); d=sqlite3.connect('/data/backup.sqlite3'); s.backup(d); d.close(); s.close(); print('backup ok')"
```

После этого `server-data/unified/data/backup.sqlite3` и каталог uploads нужно
скопировать за пределы рабочего каталога сервера.
