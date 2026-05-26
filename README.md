# SEB0G1SHOPCHIK

Личный Avito-кабинет для товаров, массовой загрузки, матрицы цветов/размеров, публикации через Autoload API, массовой смены цен, отзывов, автоответов в сообщения и online worker.

Приложение не использует браузерную имитацию, скрейпинг или обходы. Если Авито не выдал доступ к Autoload, Messenger, Reviews или Online endpoint, интерфейс показывает это как ограничение API.

## Локальный запуск

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run db:init
npm.cmd run dev
```

Открыть: `http://localhost:4317`.

Worker для online, отзывов, сообщений и отчетов запускается вторым терминалом:

```powershell
npm.cmd run worker
```

## Основные страницы

- `/products` — каталог, фильтры, массовая смена цен.
- `/products/new` — мастер “один бренд + одна категория Avito + много цветов/размеров”.
- `/products/:id` — редактор параметров, фото по цветам, матрица вариантов, описание, публикация.
- `/reviews` — очередь отзывов: новые, черновики, автоотправленные, ошибки, низкая оценка.
- `/templates` — шаблоны ответов на отзывы, включая `autoSend`.
- `/messages` — чаты и история автоответов.
- `/message-rules` — правила “если сообщение содержит слова, ответить текстом”.
- `/automation` — состояние online, отзывов, сообщений, отчетов и последние ошибки API.
- `/settings` — Avito API, OAuth callback, контакты, Autoload и capabilities.

## VPS Deploy

Порт приложения: `4317`. Это сделано специально, чтобы проект жил рядом с другими сайтами на VPS.

### 1. Клонировать

```bash
cd /opt
git clone https://github.com/Seb0g1/SEB0G1SHOPCHIK.git
cd SEB0G1SHOPCHIK
```

### 2. Создать `.env`

```bash
cp .env.example .env
nano .env
```

Готовый production-шаблон:

```env
DATABASE_URL=file:./../data/prod.db
APP_PUBLIC_URL=https://amsterdam2.sebog1.ru
APP_PORT=4317
SETTINGS_ENCRYPTION_KEY=put-a-long-random-secret-here

AVITO_API_BASE_URL=https://api.avito.ru
AVITO_REDIRECT_URL=https://amsterdam2.sebog1.ru/api/avito/oauth/callback
AVITO_ACCOUNT_ID=self

AVITO_AUTOLOAD_PROFILE_PATH=/autoload/v2/profile
AVITO_AUTOLOAD_UPLOAD_PATH=/autoload/v1/upload
AVITO_AUTOLOAD_REPORTS_PATH=/autoload/v2/reports
AVITO_AUTOLOAD_REPORT_PATH=/autoload/v3/reports/{reportId}
AVITO_AUTOLOAD_LAST_REPORT_PATH=/autoload/v3/reports/last_completed_report
AVITO_AUTOLOAD_REPORT_ITEMS_PATH=/autoload/v2/reports/{reportId}/items

AVITO_REVIEWS_LIST_PATH=/ratings/v1/reviews
AVITO_REVIEW_DETAIL_PATH=/ratings/v1/reviews/{reviewId}
AVITO_REVIEW_REPLY_PATH=/ratings/v1/reviews/{reviewId}/reply

AVITO_MESSENGER_CHATS_PATH=/messenger/v2/accounts/{accountId}/chats
AVITO_MESSENGER_MESSAGES_PATH=/messenger/v3/accounts/{accountId}/chats/{chatId}/messages
AVITO_MESSENGER_SEND_PATH=/messenger/v1/accounts/{accountId}/chats/{chatId}/messages
AVITO_ONLINE_PRESENCE_PATH=/messenger/v1/accounts/{accountId}/online

AVITO_WORKER_ONLINE_INTERVAL_SECONDS=45
AVITO_WORKER_REVIEWS_INTERVAL_SECONDS=180
AVITO_WORKER_MESSAGES_INTERVAL_SECONDS=45
AVITO_WORKER_REPORTS_INTERVAL_SECONDS=300

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Секрет для `SETTINGS_ENCRYPTION_KEY`:

```bash
openssl rand -base64 48
```

Client ID и Client Secret можно ввести на странице `/settings`; они сохраняются в SQLite, secret шифруется.

### 3. Запуск Docker

Современный Docker:

```bash
docker compose up -d --build
docker compose logs -f
```

Legacy Docker на старом VPS:

```bash
docker-compose up -d --build
docker-compose logs -f
```

Или helper:

```bash
sh scripts/deploy.sh
```

Если старый `docker-compose 1.29.x` падает с `KeyError: 'ContainerConfig'`, пересоздать контейнеры проекта:

```bash
docker-compose down --remove-orphans || true
docker rm -f seb0g1shopchik seb0g1shopchik-worker 2>/dev/null || true
docker-compose build --pull
docker-compose up -d --force-recreate --remove-orphans
docker-compose logs -f
```

Данные лежат в `./data`, поэтому пересоздание контейнеров не удаляет товары, фото и SQLite.

Compose запускает:

```text
avito-manager -> Next.js app
avito-worker  -> online/reviews/messages/reports worker
```

Проброс:

```text
127.0.0.1:4317 -> app:4317
```

### 4. Nginx домен

Создать `/etc/nginx/sites-available/amsterdam2.sebog1.ru`:

```nginx
server {
    listen 80;
    server_name amsterdam2.sebog1.ru;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:4317;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/amsterdam2.sebog1.ru /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. HTTPS

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d amsterdam2.sebog1.ru
```

### 6. DNS

```text
amsterdam2.sebog1.ru -> YOUR_VPS_PUBLIC_IP
```

## Avito

В Avito developer cabinet лучше указывать OAuth callback:

```text
https://amsterdam2.sebog1.ru/api/avito/oauth/callback
```

Если сейчас принят только корень домена, приложение все равно работает с `client_credentials`, но для OAuth flow callback лучше добавить отдельно.

Публикация идет скрыто через Autoload:

```text
1. Приложение генерирует внутренний Autoload URL.
2. /autoload/v2/profile сохраняет feeds_data.
3. /autoload/v1/upload запускает выгрузку.
4. /autoload/v2/reports и /autoload/v3/reports/* подтягивают результат.
```

Если в Avito API catalog для вашего аккаунта пути отличаются, измените соответствующие `AVITO_*_PATH` в `.env` и перезапустите контейнеры:

```bash
docker-compose up -d --force-recreate
```

## Обновление

```bash
cd /opt/SEB0G1SHOPCHIK
git pull
sh scripts/deploy.sh
```

Логи:

```bash
docker-compose logs -f avito-manager
docker-compose logs -f avito-worker
```
