# Развёртывание StreamConflicts

Актуальная production-архитектура использует одну SQLite базу и один API для RU
и EN. Фактическое состояние действующего сервера записано в `PROJECT_STATE.md`.

## Каталоги на сервере

Проект расположен в `/root/streamconflicts`.

```text
/root/streamconflicts
├── backend
├── frontend
│   ├── deploy
│   └── deploy-en
├── nginx
├── server-data
│   ├── dev
│   └── unified
│       ├── data
│       └── uploads
└── backups
```

## Сборка фронтенда на Windows

```powershell
cd D:\Active\twitch_conflicts\frontend
npm.cmd run build:all
```

Результаты:

```text
frontend/deploy
frontend/deploy-en
```

На сервер загружаются обе готовые сборки. `node_modules` не загружается.

## Production environment

Используется только `.env.prod`. Он содержит общий аккаунт администратора и
секрет единственного production API.

Ключевые параметры:

```text
DATABASE_URL=sqlite:////data/streamconflicts.sqlite3
UPLOAD_DIR=/uploads
SITE_LANG=ru
SITE_BASE_URL=https://streamconflicts.com
SITE_PATH_PREFIX=
ALT_SITE_PATH_PREFIX=en
```

`.env.en` и отдельный EN API больше не используются.

## Подготовка каталогов

```bash
cd /root/streamconflicts
mkdir -p server-data/unified/data
mkdir -p server-data/unified/uploads/ru
mkdir -p server-data/unified/uploads/en
mkdir -p backups
chown -R 100:101 server-data/unified
chmod 600 .env.prod
```

## Запуск

```bash
cd /root/streamconflicts
docker compose config --quiet
docker compose build api-prod
docker compose up -d api-prod frontend-prod frontend-en
docker compose ps
```

Проверка API напрямую:

```bash
curl http://127.0.0.1:8002/api/health
curl -H 'X-Site-Lang: en' http://127.0.0.1:8002/api/health
```

## Nginx

```bash
cp /root/streamconflicts/nginx/streamconflicts.conf /etc/nginx/sites-available/streamconflicts.conf
nginx -t
systemctl reload nginx
```

Nginx направляет `/api` и `/en/api` в один API на порту 8002 и добавляет
соответствующий `X-Site-Lang`.

## Полная публичная проверка

```bash
curl https://streamconflicts.com/api/health
curl https://streamconflicts.com/en/api/health
curl -s https://streamconflicts.com/api/conflicts | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"
curl -s https://streamconflicts.com/en/api/conflicts | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"
curl -s -o /dev/null -w 'RU sitemap: %{http_code}\n' https://streamconflicts.com/sitemap.xml
curl -s -o /dev/null -w 'EN sitemap: %{http_code}\n' https://streamconflicts.com/en/sitemap.xml
curl -s -o /dev/null -w 'RU RSS: %{http_code}\n' https://streamconflicts.com/rss.xml
curl -s -o /dev/null -w 'EN RSS: %{http_code}\n' https://streamconflicts.com/en/rss.xml
```

## Резервная копия

```bash
cd /root/streamconflicts
docker compose exec api-prod python -c "import sqlite3; s=sqlite3.connect('/data/streamconflicts.sqlite3'); d=sqlite3.connect('/data/backup.sqlite3'); s.backup(d); d.close(); s.close(); print('backup ok')"
cp server-data/unified/data/backup.sqlite3 backups/streamconflicts.sqlite3
tar -czf backups/unified-uploads.tar.gz server-data/unified/uploads
```

SQLite копируется только через backup API. Резервные копии нужно переносить за
пределы сервера.

## Миграции

Миграции запускаются entrypoint API автоматически.

```bash
docker compose exec api-prod alembic current
```

Актуальная версия перед началом истории: `0013_analytics_language`.
