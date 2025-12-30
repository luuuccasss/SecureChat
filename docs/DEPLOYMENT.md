# Guide de Déploiement - ChatSecure

## Prérequis

- Node.js 18+ et npm
- MongoDB 5.0+
- Git

## Installation Locale

### 1. Cloner le projet

```bash
git clone <repository-url>
cd ChatSecure
```

### 2. Installer les dépendances

```bash
# Installer toutes les dépendances (root, server, client)
npm run install:all
```

### 3. Configurer MongoDB

```bash
# Démarrer MongoDB (selon votre installation)
mongod

# Ou avec Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 4. Configurer les variables d'environnement

```bash
# Copier le fichier d'exemple
cp server/.env.example server/.env

# Éditer server/.env
nano server/.env
```

Variables minimales :
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/s25_testchat
JWT_SECRET=votre-secret-jwt-min-32-caracteres
CORS_ORIGIN=http://localhost:3000
```

### 5. Démarrer l'application

```bash
# Développement (backend + frontend)
npm run dev

# Ou séparément
npm run dev:server  # Terminal 1
npm run dev:client  # Terminal 2
```

L'application sera accessible sur :
- Frontend : http://localhost:3000
- Backend : http://localhost:3001

## Déploiement Production

### Option 1 : Déploiement avec PM2

#### 1. Installer PM2

```bash
npm install -g pm2
```

#### 2. Build du frontend

```bash
cd client
npm run build
cd ..
```

#### 3. Configurer PM2

Créer `ecosystem.config.js` :

```javascript
module.exports = {
  apps: [{
    name: 's25_testchat-server',
    script: './server/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

#### 4. Démarrer avec PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Option 2 : Déploiement avec Docker

#### 1. Créer Dockerfile

`Dockerfile` :
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Installer les dépendances
RUN npm install
RUN cd server && npm install
RUN cd client && npm install && npm run build

# Copier le code
COPY . .

# Exposer le port
EXPOSE 3001

# Démarrer
CMD ["node", "server/index.js"]
```

#### 2. Créer docker-compose.yml

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:latest
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: strong-password
    ports:
      - "27017:27017"

  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://admin:strong-password@mongodb:27017/s25_testchat?authSource=admin
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=${CORS_ORIGIN}
    depends_on:
      - mongodb

volumes:
  mongodb_data:
```

#### 3. Démarrer

```bash
docker-compose up -d
```

### Option 3 : Déploiement Cloud (Heroku, Railway, etc.)

#### Heroku

```bash
# Installer Heroku CLI
heroku login

# Créer l'application
heroku create s25_testchat-app

# Ajouter MongoDB (MongoDB Atlas ou Heroku addon)
heroku addons:create mongolab:sandbox

# Configurer les variables
heroku config:set JWT_SECRET=your-secret
heroku config:set CORS_ORIGIN=https://your-app.herokuapp.com

# Déployer
git push heroku main
```

#### Railway

1. Connecter le repository GitHub
2. Configurer les variables d'environnement
3. Déployer automatiquement

## Configuration Nginx (Reverse Proxy)

### Installation

```bash
sudo apt update
sudo apt install nginx
```

### Configuration

`/etc/nginx/sites-available/s25_testchat` :

```nginx
server {
    listen 80;
    server_name votre-domaine.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name votre-domaine.com;

    ssl_certificate /etc/letsencrypt/live/votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.com/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Headers de sécurité
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (React build)
    location / {
        root /var/www/s25_testchat/client/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Activer le site

```bash
sudo ln -s /etc/nginx/sites-available/s25_testchat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Certificat SSL (Let's Encrypt)

```bash
# Installer Certbot
sudo apt install certbot python3-certbot-nginx

# Obtenir le certificat
sudo certbot --nginx -d votre-domaine.com

# Renouvellement automatique
sudo certbot renew --dry-run
```

## MongoDB Atlas (Cloud)

### Configuration

1. Créer un cluster sur [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Créer un utilisateur avec permissions
3. Whitelist l'IP du serveur
4. Obtenir la connection string

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/s25_testchat?retryWrites=true&w=majority
```

## Monitoring

### PM2 Monitoring

```bash
pm2 monit
pm2 logs
```

### Logs

```bash
# Logs applicatifs
tail -f logs/app.log

# Logs Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Health Check

```bash
# Endpoint de santé
curl http://localhost:3001/api/health
```

## Backup

### MongoDB Backup

```bash
# Backup manuel
mongodump --uri="mongodb://localhost:27017/s25_testchat" --out=/backup/$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb://localhost:27017/s25_testchat" /backup/20240101
```

### Backup automatique (cron)

```bash
# Éditer crontab
crontab -e

# Backup quotidien à 2h du matin
0 2 * * * mongodump --uri="mongodb://localhost:27017/s25_testchat" --out=/backup/$(date +\%Y\%m\%d)
```

## Mise à jour

```bash
# Pull les dernières modifications
git pull origin main

# Installer les nouvelles dépendances
npm run install:all

# Rebuild
cd client && npm run build && cd ..

# Redémarrer
pm2 restart s25_testchat-server
# Ou
docker-compose restart
```

## Troubleshooting

### Port déjà utilisé

```bash
# Trouver le processus
lsof -i :3001

# Tuer le processus
kill -9 <PID>
```

### MongoDB ne démarre pas

```bash
# Vérifier les logs
tail -f /var/log/mongodb/mongod.log

# Vérifier les permissions
sudo chown -R mongodb:mongodb /var/lib/mongodb
```

### Erreurs de connexion Socket.IO

- Vérifier CORS_ORIGIN
- Vérifier les headers proxy
- Vérifier les certificats SSL

## Checklist Production

- [ ] HTTPS configuré et fonctionnel
- [ ] Variables d'environnement configurées
- [ ] MongoDB sécurisé avec authentification
- [ ] Firewall configuré
- [ ] Backups automatiques configurés
- [ ] Monitoring en place
- [ ] Logs configurés
- [ ] Rate limiting activé
- [ ] Tests effectués
- [ ] Documentation à jour

