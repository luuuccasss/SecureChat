# Deployment

SecureChat is a Node.js API (Express + Socket.IO + MySQL) and a static React app.

## Requirements

- Node.js 20+
- MySQL 8
- HTTPS in production: the Web Crypto API only works in a secure context

## 1. Database

```sql
CREATE USER 'securechat'@'localhost' IDENTIFIED BY 'a-strong-password';
GRANT ALL PRIVILEGES ON securechat.* TO 'securechat'@'localhost';
```

```sh
mysql -u root -p < server/database/schema.sql
```

Upgrading an existing install: run the files in `server/database/migrations/` in order.
`002_e2ee_v2.sql` removes data written by 1.x clients, which was never actually encrypted,
and accounts created before 2.0 have to register again.

## 2. Server

```sh
cd server
npm ci --omit=dev
cp .env.example .env
```

Required in `server/.env`:

| Variable | Value |
|---|---|
| `JWT_SECRET` | random, 32+ characters: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `DB_USER`, `DB_PASSWORD` | the dedicated MySQL user |
| `CORS_ORIGIN` | public URL of the web app, e.g. `https://chat.example.com` |
| `TRUST_PROXY` | `1` behind one reverse proxy (nginx), empty otherwise |

Start it with `node index.js` under a process manager (systemd, PM2, Docker...).
Expired and orphaned uploads are cleaned up automatically every 6 hours.

## 3. Web app

The API URLs are compiled into the app and define its Content-Security-Policy:

```sh
cd client
npm ci
REACT_APP_API_URL=https://chat.example.com/api \
REACT_APP_SOCKET_URL=https://chat.example.com \
npm run build
```

Serve `client/build/` as static files, with every unknown path falling back to `index.html`.

## 4. Reverse proxy (nginx)

```nginx
server {
  listen 443 ssl http2;
  server_name chat.example.com;
  # ssl_certificate ... (Let's Encrypt)

  root /var/www/securechat/client/build;
  add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options DENY always;
  add_header Referrer-Policy no-referrer always;

  location / {
    try_files $uri /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 11m;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

## 5. Tests

The test suite runs against a live server and database, like in CI. The end-to-end
encryption tests also read the database, so they need the same `DB_*` variables:

```sh
cd server
RATE_LIMIT_MAX=100000 AUTH_RATE_LIMIT_MAX=100000 node index.js &
SC_URL=http://localhost:3001 DB_USER=securechat DB_PASSWORD=... npm test
```
