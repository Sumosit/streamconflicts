# Обновление dev и prod

Все команды на сервере выполняются из:

```bash
cd /root/streamconflicts
```

Данные SQLite и загруженные изображения находятся в `server-data`. Команды `docker compose build` и `docker compose up` их не удаляют.

## Что загружать через WinSCP

Если изменился frontend:

```text
frontend/deploy
frontend/deploy-en
```

Русская и английская версии собираются отдельно:

```powershell
cd D:\Active	witch_conflictsrontend
npm.cmd run build:all
```

Если изменился backend:

```text
backend/app
backend/migrations/versions
```

Если изменились Docker-файлы:

```text
docker-compose.yml
backend/Dockerfile
backend/docker-entrypoint.sh
backend/requirements.txt
```

Системный Nginx-конфиг не нужно перезаписывать при обычном обновлении frontend или backend.

## Обновить только frontend dev

Фронтенд не собирается в образ: контейнер запускает готовую сборку из
примонтированной папки. Достаточно залить `frontend/deploy` и перезапустить.

```bash
cd /root/streamconflicts
docker compose restart frontend-dev
docker compose ps frontend-dev
```

Проверка:

```bash
curl -I https://dev.streamconflicts.com
```

## Обновить только backend dev

```bash
cd /root/streamconflicts
docker compose build api-dev
docker compose up -d api-dev
docker compose ps api-dev
```

Проверка:

```bash
curl https://dev.streamconflicts.com/api/health
docker compose exec api-dev alembic current
```

## Обновить frontend и backend dev

```bash
cd /root/streamconflicts
docker compose build api-dev
docker compose up -d api-dev
docker compose restart frontend-dev
docker compose ps api-dev frontend-dev
```

## Обновить английскую версию

Английская версия живёт на `https://streamconflicts.com/en`, у неё отдельная база
в `server-data/en` и отдельный редактор со своим паролем.

При первом развёртывании папки данных нужно передать пользователю контейнера,
иначе SQLite не сможет создать файл базы (`unable to open database file`):

```bash
mkdir -p server-data/en/data server-data/en/uploads
chown -R 100:101 server-data/en
```

Корневой `robots.txt` отдаёт `api-prod`: поисковики читают этот файл только из
корня домена, поэтому sitemap английского раздела объявлен там. За это отвечает
`ALT_SITE_PATH_PREFIX=en` в `.env.prod`.

```bash
cd /root/streamconflicts
docker compose build api-en
docker compose up -d api-en
docker compose restart frontend-en
docker compose ps api-en frontend-en
```

Проверка:

```bash
curl -I https://streamconflicts.com/en
curl https://streamconflicts.com/en/api/health
```

## Резервная копия перед обновлением prod

```bash
cd /root/streamconflicts
docker compose exec api-prod python -c "import sqlite3; s=sqlite3.connect('/data/streamconflicts.sqlite3'); d=sqlite3.connect('/data/streamconflicts-backup.sqlite3'); s.backup(d); d.close(); s.close(); print('backup ok')"
```

Файл резервной копии появится здесь:

```text
/root/streamconflicts/server-data/prod/data/streamconflicts-backup.sqlite3
```

## Обновить только frontend prod

```bash
cd /root/streamconflicts
docker compose restart frontend-prod
docker compose ps frontend-prod
```

Проверка:

```bash
curl -I https://streamconflicts.com
```

## Обновить только backend prod

Сначала сделать резервную копию базы, затем:

```bash
cd /root/streamconflicts
docker compose build api-prod
docker compose up -d api-prod
docker compose ps api-prod
```

Проверка:

```bash
curl https://streamconflicts.com/api/health
docker compose exec api-prod alembic current
```

## Обновить frontend и backend prod

Сначала сделать резервную копию базы, затем:

```bash
cd /root/streamconflicts
docker compose build api-prod
docker compose up -d api-prod
docker compose restart frontend-prod
docker compose ps api-prod frontend-prod
```

Проверка:

```bash
curl https://streamconflicts.com/api/health
curl -I https://streamconflicts.com
docker compose exec api-prod alembic current
```

## Ограничения по памяти

На сервере около 800 МБ RAM. Каждому контейнеру задан `mem_limit: 256m`,
у SSR дополнительно ограничена куча Node (`--max-old-space-size=160`).

Dev-окружение стоит держать выключенным, пока оно не нужно: это освобождает
примерно 250 МБ.

```bash
docker compose stop api-dev frontend-dev
docker compose start api-dev frontend-dev
```

Признак нехватки памяти: 504 от nginx одновременно на всех сайтах и
`upstream timed out` в `/var/log/nginx/error.log`. Проверять через `free -m`.

## Посмотреть логи

Dev:

```bash
docker compose logs --tail=100 api-dev frontend-dev
```

Prod:

```bash
docker compose logs --tail=100 api-prod frontend-prod
```

Следить за логами в реальном времени:

```bash
docker compose logs -f api-prod frontend-prod
```

Остановить просмотр логов: `Ctrl+C`. Контейнеры при этом продолжат работать.

## Когда нужен Nginx

Перезагружать системный Nginx нужно только после изменения файла активной конфигурации в `/etc/nginx`:

```bash
nginx -t
systemctl reload nginx
```

При обычном обновлении Angular или FastAPI эти команды не нужны.

Не перезаписывать активный SSL-конфиг локальным файлом без проверки. Certbot добавляет в него пути к сертификатам.
