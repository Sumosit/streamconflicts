# StreamArchive frontend

Angular 20 SSR-приложение собирается в двух языковых вариантах из одного исходного
кода.

## Сборка

```powershell
cd D:\Active\twitch_conflicts\frontend
npm.cmd run build:all
```

Результат:

```text
deploy      RU, base href /
deploy-en   EN, base href /en/
```

Отдельные команды:

```powershell
npm.cmd run build:ru
npm.cmd run build:en
```

Обе production-сборки проверены 2 сентября 2026 года.

## API

RU-сборка обращается к `/api`. EN-сборка обращается к `/en/api`. Оба адреса
ведут в один backend, язык добавляет Nginx.

## Аналитика редактора

На `/editor/analytics` и `/en/editor/analytics` доступен один отчёт с режимами:

```text
RU | EN | Общая
```

Frontend передаёт параметр `site_lang` в административный API.

## Локальная разработка

```powershell
npm.cmd start
```

Dev server работает на `http://localhost:4200` и использует `proxy.conf.json`.
