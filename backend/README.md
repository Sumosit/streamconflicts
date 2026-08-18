# StreamArchive backend

FastAPI API for the editor and public site. Runtime databases and uploaded images exist only on the Ubuntu server.

## Environments on one server

| Environment | API port | SQLite | Uploads |
|---|---:|---|---|
| dev | `127.0.0.1:8001` | `server-data/dev/data/streamconflicts-dev.sqlite3` | `server-data/dev/uploads/` |
| prod | `127.0.0.1:8002` | `server-data/prod/data/streamconflicts.sqlite3` | `server-data/prod/uploads/` |

The directories and secrets are not committed to Git.

The complete Compose, environment examples, Nginx configuration and deployment instructions are stored in the project root at `/root/streamconflicts`. Follow `DEPLOY.md` from the root instead of running the backend separately.

## Endpoints

- `POST /api/auth/token` - editor login.
- `GET /api/conflicts` - published archive.
- `GET /api/conflicts/{slug}` - published material.
- `GET /api/admin/conflicts` - all editor materials.
- `POST /api/admin/conflicts` - create material.
- `PATCH /api/admin/conflicts/{id}` - edit and add change log entry.
- `DELETE /api/admin/conflicts/{id}` - archive material.
- `POST /api/admin/people` - create person.
- `POST /api/admin/uploads/images` - validate and store an image as WebP.
- `POST /api/conflicts/{slug}/corrections` - public correction request.
- `GET /api/admin/corrections` - correction request queue.
- `PATCH /api/admin/corrections/{id}` - accept or reject a correction request.
- `GET /docs` - interactive OpenAPI documentation.

## Backups

Back up the database through the SQLite backup command, not by copying a live WAL database file:

```bash
docker compose exec api-prod python -c "import sqlite3; s=sqlite3.connect('/data/streamconflicts.sqlite3'); d=sqlite3.connect('/data/backup.sqlite3'); s.backup(d); d.close(); s.close()"
```

Copy `backup.sqlite3` and the prod uploads directory to storage outside this server.
