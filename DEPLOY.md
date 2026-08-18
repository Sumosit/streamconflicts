# Развертывание StreamConflicts на Ubuntu

Все команды в этом документе выполняются по очереди. Проект размещается в `/root/streamconflicts`. Конфигурация проекта находится в его корне, системный Nginx только подключает подготовленный файл.

## 1. DNS

Создать A-записи, указывающие на публичный IPv4 сервера:

| Имя | Значение |
|---|---|
| `@` | IP сервера |
| `www` | IP сервера |
| `dev` | IP сервера |

Проверка после обновления DNS:

```bash
getent hosts streamconflicts.com
getent hosts dev.streamconflicts.com
```

## 2. Подготовка Ubuntu

Нужны Docker Engine с Compose plugin, Nginx и Certbot. После установки проверить:

```bash
docker --version
docker compose version
nginx -v
certbot --version
```

Открыть только SSH, HTTP и HTTPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 3. Сборка фронтенда на Windows

В PowerShell:

```powershell
cd D:\Active\twitch_conflicts\frontend
npm.cmd run build:all
```

Команда собирает обе языковые версии: русскую в `frontend/deploy` и английскую
в `frontend/deploy-en` (base href `/en/`, отдельный API-префикс `/en/api`).
Отдельно: `npm.cmd run build:ru` и `npm.cmd run build:en`.

Готовый сайт находится в `frontend/deploy/browser`. На сервер исходники Angular и `node_modules` не переносятся.

## 4. Перенос через WinSCP

Создать `/root/streamconflicts` и загрузить в него:

- `backend` целиком;
- `nginx` целиком;
- `docker-compose.yml`, `.env.dev.example`, `.env.prod.example`, `.env.en.example`, `.gitignore` и `DEPLOY.md`;
- в `frontend` только `deploy` и `deploy-en` (образ фронтенда не собирается, сборка монтируется в контейнер).

Проверить структуру:

```bash
cd /root/streamconflicts
ls -la
docker compose config
```

Последнюю команду запускать после создания `.env.dev` и `.env.prod` на следующем шаге.

## 5. Секреты и каталоги данных

```bash
cd /root/streamconflicts
cp .env.dev.example .env.dev
cp .env.prod.example .env.prod
openssl rand -hex 32
openssl rand -hex 32
nano .env.dev
nano .env.prod
mkdir -p server-data/{dev,prod}/{data,uploads}
chmod 600 .env.dev .env.prod
```

Вставить разные результаты `openssl` в `JWT_SECRET`. Также установить разные длинные пароли `BOOTSTRAP_ADMIN_PASSWORD`.

Не копировать базу dev в prod. Каталоги разделены физически:

- `server-data/dev/data` и `server-data/dev/uploads`
- `server-data/prod/data` и `server-data/prod/uploads`

## 6. Сборка и запуск контейнеров

```bash
cd /root/streamconflicts
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Проверить сервисы напрямую на сервере:

```bash
curl http://127.0.0.1:8001/api/health
curl http://127.0.0.1:8002/api/health
curl -I http://127.0.0.1:8081
curl -I http://127.0.0.1:8082
```

SQLite и каталоги изображений создаются только на сервере при запуске API.

## 7. Подключение Nginx

```bash
cp /root/streamconflicts/nginx/streamconflicts.conf /etc/nginx/sites-available/streamconflicts.conf
sudo ln -s /etc/nginx/sites-available/streamconflicts.conf /etc/nginx/sites-enabled/streamconflicts.conf
sudo nginx -t
sudo systemctl reload nginx
```

Если стандартный сайт Nginx мешает:

```bash
sudo unlink /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Проверка по HTTP:

```bash
curl -I http://streamconflicts.com
curl http://streamconflicts.com/api/health
curl -I http://dev.streamconflicts.com
curl http://dev.streamconflicts.com/api/health
```

## 8. HTTPS

DNS уже должен указывать на сервер, а порт 80 должен быть доступен извне:

```bash
sudo certbot --nginx -d streamconflicts.com -d www.streamconflicts.com
sudo certbot --nginx -d dev.streamconflicts.com
sudo certbot renew --dry-run
```

После этого проверить обе среды в браузере.

## 9. Последующие обновления

Загрузить свежий архив, распаковать поверх исходного кода и выполнить:

```bash
cd /root/streamconflicts
docker compose build
docker compose up -d
docker compose ps
```

Миграции Alembic запускаются API-контейнерами автоматически. `server-data` при обновлении не удаляется.

## 10. Резервная копия prod

```bash
cd /root/streamconflicts
mkdir -p backups
docker compose exec api-prod python -c "import sqlite3; s=sqlite3.connect('/data/streamconflicts.sqlite3'); d=sqlite3.connect('/data/backup.sqlite3'); s.backup(d); d.close(); s.close()"
cp server-data/prod/data/backup.sqlite3 backups/
tar -czf backups/prod-uploads.tar.gz server-data/prod/uploads
```

Копии необходимо регулярно переносить на другой сервер или в объектное хранилище.
