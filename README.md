# SEB0G1SHOPCHIK

Avito Dropshipping Manager: single-user web app for preparing Avito listings with product templates, color/size variants, photo sets, Avito-safe descriptions, XML feed export, and an isolated Avito API adapter.

## Local Run

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run db:init
npm.cmd run dev
```

Open `http://localhost:4317`.

## VPS Deploy

The app listens on a nonstandard port: `4317`, so it can live next to other projects on the same VPS.

### 1. Clone on server

```bash
cd /opt
git clone https://github.com/Seb0g1/SEB0G1SHOPCHIK.git
cd SEB0G1SHOPCHIK
```

### 2. Create environment file

```bash
cp .env.example .env
nano .env
```

Recommended production values:

```env
DATABASE_URL=file:./../data/prod.db
APP_PUBLIC_URL=https://amsterdam2.sebog1.ru
APP_PORT=4317
AVITO_API_BASE_URL=https://api.avito.ru
AVITO_REDIRECT_URL=https://amsterdam2.sebog1.ru/api/avito/oauth/callback
SETTINGS_ENCRYPTION_KEY=put-a-long-random-secret-here
OPENAI_API_KEY=""
OPENAI_MODEL=gpt-4.1-mini
```

Generate a strong secret:

```bash
openssl rand -base64 48
```

### 3. Start with Docker Compose

For modern Docker:

```bash
docker compose up -d --build
docker compose logs -f
```

For legacy Docker / old VPS installations:

```bash
docker-compose up -d --build
docker-compose logs -f
```

Or use the helper script that auto-detects the available command:

```bash
sh scripts/deploy.sh
```

If `docker-compose` is not installed:

```bash
sudo apt update
sudo apt install -y docker-compose
```

The container maps:

```text
127.0.0.1:4317 -> app:4317
```

### 4. Nginx domain binding

Create `/etc/nginx/sites-available/amsterdam2.sebog1.ru`:

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

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/amsterdam2.sebog1.ru /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. HTTPS via Certbot

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d amsterdam2.sebog1.ru
```

### 6. DNS

Create an `A` record at your DNS provider:

```text
amsterdam2.sebog1.ru -> YOUR_VPS_PUBLIC_IP
```

## Avito URLs

```text
App: https://amsterdam2.sebog1.ru
Avito redirect URL: https://amsterdam2.sebog1.ru/api/avito/oauth/callback
Public Avito feed URL: https://amsterdam2.sebog1.ru/api/avito/feed.xml
```

## Updating Deployment

```bash
cd /opt/SEB0G1SHOPCHIK
git pull
sh scripts/deploy.sh
```
