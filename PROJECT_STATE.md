# Текущее состояние StreamConflicts

Дата фиксации: 2 сентября 2026 года.

## Что работает в production

- Русская версия: `https://streamconflicts.com`.
- Английская версия: `https://streamconflicts.com/en`.
- Один production API на `127.0.0.1:8002` обслуживает оба языка.
- Одна SQLite база содержит данные RU и EN.
- Один аккаунт администратора используется в обоих редакторах.
- Два Angular SSR фронтенда собраны отдельно для `/` и `/en/`.
- Изображения, sitemap, RSS, robots.txt и редакторы доступны для обоих языков.

Проверенные публичные результаты после объединения:

```text
RU published conflicts: 63
EN published conflicts: 29
SQLite integrity_check: ok
SQLite foreign_key_check: []
```

Проверенные данные объединённой базы:

```text
conflicts: 94
people: 381
timeline_events: 1973
sources: 2895
conflict_people: 547
change_log: 349
site_pages: 4
analytics_visits на момент объединения: 2131
```

## Production-архитектура

```text
Nginx
├── /api/*        -> api-prod:8002, X-Site-Lang: ru
├── /uploads/*    -> api-prod:8002, X-Site-Lang: ru
├── /en/api/*     -> api-prod:8002, X-Site-Lang: en
├── /en/uploads/* -> api-prod:8002, X-Site-Lang: en
├── /*            -> frontend-prod:8082
└── /en/*         -> frontend-en:8083

api-prod
├── /data    -> server-data/unified/data
└── /uploads -> server-data/unified/uploads
```

Production больше не использует отдельный `api-en` и отдельную EN-базу.

## Языковая модель

Язык запроса определяется заголовком `X-Site-Lang`, который устанавливает Nginx.
Переменная `SITE_LANG` остаётся языком по умолчанию, но не является единственным
источником языка запроса.

Поле `site_lang` используется в таблицах `conflicts`, `people`, `site_pages`,
`material_submissions`, `correction_requests`, `analytics_visits` и
`analytics_visitors`.

Для `conflicts`, `people` и `site_pages` slug уникален внутри языка:

```text
UNIQUE(site_lang, slug)
```

## Миграции

Актуальная цепочка:

```text
0011_priority_enabled
0012_unified_languages
0013_analytics_language
```

`0012_unified_languages` добавляет языковую принадлежность редакционным данным.
`0013_analytics_language` добавляет язык визитам и посетителям. Административный
отчёт принимает `site_lang=ru`, `site_lang=en` или `site_lang=all`.

## Аналитика

Страница `/editor/analytics` и её EN-версия имеют переключатель:

```text
RU | EN | Общая
```

Новые посещения сохраняются с языком запроса. Идентификатор посетителя получает
префикс `ru:` или `en:`, поэтому один браузер учитывается отдельно для обоих
языковых сайтов.

### Текущий незавершённый пункт

Первая версия миграции пыталась распознать старые EN-визиты по пути `/en/...`.
Angular Router передавал пути без языкового префикса, поэтому старые EN-записи
могли попасть в RU. Симптом: вкладка EN пустая, а RU равна общей статистике.

Для исправления подготовлен скрипт:

```text
backend/scripts/repair_analytics_languages.py
```

Он пересобирает только `analytics_visits` и `analytics_visitors` из сохранённых
`ru.sqlite3` и `en.sqlite3`. Пока сервер не выведет `Analytics repair passed` и
распределение по двум языкам, восстановление старой аналитики не считается
завершённым.

## Объединение баз

Скрипты:

```text
backend/scripts/merge_databases.py
backend/scripts/verify_merged_database.py
backend/scripts/repair_analytics_languages.py
```

`merge_databases.py` создаёт новую базу и не перезаписывает существующий файл.
`verify_merged_database.py` сравнивает количества строк, языки и внешние ключи.
Исходные RU и EN базы нельзя удалять после объединения.

Сохранённые каталоги на сервере:

```text
server-data/prod
server-data/en
backups/pre-unified-final
```

Они являются резервными копиями и не подключены к работающему `api-prod`.

## Изображения

Рабочий каталог:

```text
server-data/unified/uploads
├── ru
└── en
```

API выбирает языковой подкаталог по `X-Site-Lang`. Публичные URL сохраняют вид
`/uploads/...` и `/en/uploads/...`.

## Что ещё не реализовано

- Раздел истории стриминга.
- Таблицы исторических событий и переводов.
- Публичные страницы `/history` и `/en/history`.
- Редактор истории.
- JSON-импорт истории.
- Изображения и источники исторических событий.

Следующая крупная работа начинается после подтверждения ремонта старой аналитики
и создания свежей резервной копии unified-базы.
