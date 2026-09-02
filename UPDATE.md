# Обновление StreamConflicts

Все команды на сервере выполняются из:

```bash
cd /root/streamconflicts
```

## Что загружать

При изменении backend:

```text
backend/app
backend/migrations/versions
backend/scripts
```

При изменении frontend сначала выполнить локально:

```powershell
cd D:\Active\twitch_conflicts\frontend
npm.cmd run build:all
```

Затем загрузить с полной заменой:

```text
frontend/deploy
frontend/deploy-en
```

## Обязательная копия базы перед backend-обновлением

```bash
docker compose exec api-prod python -c "import sqlite3; s=sqlite3.connect('/data/streamconflicts.sqlite3'); d=sqlite3.connect('/data/pre-update.sqlite3'); s.backup(d); d.close(); s.close(); print('backup ok')"
cp server-data/unified/data/pre-update.sqlite3 backups/pre-update.sqlite3
```

## Обновить только backend

```bash
docker compose build api-prod
docker compose up -d --force-recreate api-prod
docker compose logs --tail=100 api-prod
docker compose exec api-prod alembic current
```

Проверка:

```bash
curl https://streamconflicts.com/api/health
curl https://streamconflicts.com/en/api/health
```

## Обновить оба frontend

Фронтенды используют примонтированные production-сборки, поэтому Docker-образ
для них не собирается.

```bash
docker compose restart frontend-prod frontend-en
docker compose ps frontend-prod frontend-en
```

Проверка:

```bash
curl -I https://streamconflicts.com
curl -I https://streamconflicts.com/en
```

## Обновить всё

```bash
docker compose build api-prod
docker compose up -d --force-recreate api-prod
docker compose restart frontend-prod frontend-en
docker compose ps api-prod frontend-prod frontend-en
docker compose logs --tail=100 api-prod frontend-prod frontend-en
```

## Ремонт старой аналитики RU и EN

Этот раздел нужен только пока не подтверждено успешное распределение старых
визитов по языкам.

```bash
docker compose stop api-prod
cp server-data/unified/data/streamconflicts.sqlite3 backups/before-analytics-repair.sqlite3
python3 backend/scripts/repair_analytics_languages.py \
  --ru backups/pre-unified-final/ru.sqlite3 \
  --en backups/pre-unified-final/en.sqlite3 \
  --merged server-data/unified/data/streamconflicts.sqlite3
chown -R 100:101 server-data/unified
docker compose up -d api-prod
```

Проверка:

```bash
python3 -c "import sqlite3; c=sqlite3.connect('server-data/unified/data/streamconflicts.sqlite3'); print(c.execute('SELECT site_lang, COUNT(*) FROM analytics_visits GROUP BY site_lang').fetchall()); print(c.execute('SELECT site_lang, COUNT(*) FROM analytics_visitors GROUP BY site_lang').fetchall()); print(c.execute('PRAGMA integrity_check').fetchone()[0]); c.close()"
```

## Логи и память

```bash
docker compose logs --tail=100 api-prod frontend-prod frontend-en
free -m
```

Каждый контейнер ограничен `256m`. Dev-среду рекомендуется держать выключенной,
если она не используется.

## Когда перезагружать Nginx

Только после изменения активного Nginx-конфига:

```bash
nginx -t
systemctl reload nginx
```

При обычном обновлении Angular или FastAPI Nginx перезагружать не нужно.
