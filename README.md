# 🔐 SecureChat

**End-to-end encrypted real-time messaging system with advanced moderation and complete legal protection.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.0.0-blue.svg)
![MySQL](https://img.shields.io/badge/mysql-8.0+-orange.svg)

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Project Structure](#-project-structure)
- [Security](#-security)
- [Development](#-development)
- [Deployment](#-deployment)
- [Legal](#-legal)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### 🔒 Security

- **End-to-End Encryption (E2EE)**: AES-256-GCM + RSA-2048
- **Zero-Knowledge Architecture**: Server cannot decrypt messages
- **Secure JWT Authentication**: Token-based authentication
- **Anti-Spam/Flood Protection**: Rate limiting and abuse detection
- **IP Blacklisting**: Automatic blocking of abusive IPs
- **Strict Input Validation**: Protection against XSS and injection attacks
- **Complete Room Isolation**: Messages encrypted per room

### 💬 Real-Time Communication

- **WebSocket Support**: Real-time messaging via Socket.IO
- **Public/Private Rooms**: Password-protected private rooms
- **Persistent Message History**: All messages stored and encrypted
- **Real-Time Indicators**: Online status, typing indicators, read receipts
- **Encrypted File Upload**: Support for images, PDFs, documents
- **Real-Time Notifications**: Instant message delivery

### 🛡️ Moderation

- **Role System**: Owner, Admin, Member roles
- **User Banning**: Temporary or permanent bans
- **Message Deletion**: Moderators can delete messages
- **Audit Logs**: Complete audit trail of all actions
- **Room Options**: Moderation, slow mode, read-only, archiving

### ⚖️ Legal Compliance

- **Terms of Service**: Complete terms and conditions
- **Privacy Policy**: GDPR-compliant privacy policy
- **Legal Mentions**: Full legal disclaimers
- **Data Protection**: User data protection measures
- **Disclaimer**: Comprehensive legal protection (see [DISCLAIMER.md](DISCLAIMER.md))

### 🌍 Internationalization

- **Multi-language Support**: English (default) and French
- **Language Switcher**: Easy language selection in UI
- **Browser Language Detection**: Automatic language detection
- **Persistent Preferences**: Language preference saved in localStorage

## 🏗️ Architecture

### Technology Stack

**Backend:**
- Node.js + Express.js
- Socket.IO (WebSocket)
- MySQL + Sequelize ORM
- JWT (Authentication)
- bcrypt (Password hashing)

**Frontend:**
- React 18
- Socket.IO Client
- Web Crypto API (E2EE encryption)
- Axios (HTTP client)

**Database:**
- MySQL 8.0+

### System Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client    │◄───────►│   Server    │◄───────►│   MySQL     │
│   (React)   │  HTTPS  │  (Express)  │  SQL    │  Database   │
│             │         │             │         │             │
│ E2EE Crypto │         │ Socket.IO   │         │ Sequelize   │
└─────────────┘         └─────────────┘         └─────────────┘
```

## 🚀 Installation

### Prerequisites

- **Node.js** >= 16.0.0
- **MySQL** >= 8.0
- **npm** or **yarn**

### Step-by-Step Installation

1. **Clone the repository**
```bash
git clone https://github.com/luuuccasss/SecureChat.git
cd SecureChat
```

2. **Install all dependencies**
```bash
npm run install:all
```

This will install dependencies for:
- Root project
- Server (`server/`)
- Client (`client/`)

3. **Set up MySQL database**
```bash
# Create the database
mysql -u root -p -e "CREATE DATABASE securechat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Import the schema
mysql -u root -p securechat < server/database/schema.sql
```

4. **Configure environment variables**

**Server configuration:**
```bash
cd server
cp .env.example .env
# Edit .env with your actual values
```

**Client configuration:**
```bash
cd client
cp .env.example .env
# Edit .env with your actual values
```

5. **Generate a secure JWT secret**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and add it to `server/.env` as `JWT_SECRET`.

6. **Start the application**

**Development mode (both server and client):**
```bash
npm run dev
```

**Or separately:**
```bash
# Terminal 1: Backend server
npm run dev:server
# Server runs on http://localhost:3001

# Terminal 2: Frontend client
npm run dev:client
# Client runs on http://localhost:3000
```

## 📝 Configuration

### Server Environment Variables (`server/.env`)

See `server/.env.example` for a complete example with all available options.

**Required variables:**
```env
# JWT Authentication (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long

# Database Configuration (REQUIRED)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=securechat
DB_USER=root
DB_PASSWORD=your-database-password

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

**Optional variables:**
```env
# File Upload
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=image/*,application/pdf,text/plain
UPLOAD_DIR=uploads
FILE_EXPIRATION_DAYS=30

# Security
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
ENABLE_IP_BLACKLIST=true
ABUSE_THRESHOLD=10

# Socket.IO
SOCKET_PING_TIMEOUT=60000
SOCKET_PING_INTERVAL=25000

# Database Sync (Development only - WARNING: alters schema)
SYNC_DB=false
```

### Client Environment Variables (`client/.env`)

See `client/.env.example` for a complete example.

```env
# API Configuration
REACT_APP_API_URL=http://localhost:3001/api

# Socket.IO Configuration
REACT_APP_SOCKET_URL=http://localhost:3001

# File Upload
REACT_APP_MAX_FILE_SIZE=10485760
REACT_APP_ALLOWED_FILE_TYPES=image/*,.pdf,.doc,.docx,.txt

# Application
REACT_APP_NAME=SecureChat
REACT_APP_DEFAULT_LANGUAGE=en
```

## 📁 Project Structure

```
SecureChat/
├── client/                    # React frontend
│   ├── public/               # Static files
│   │   ├── index.html
│   │   ├── legal.html        # Legal mentions
│   │   ├── cgu.html          # Terms of service
│   │   └── privacy.html      # Privacy policy
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── Auth/        # Authentication components
│   │   │   ├── Chat/        # Chat components
│   │   │   └── LanguageSwitcher.js
│   │   ├── crypto/          # E2EE encryption service
│   │   ├── i18n/            # Internationalization
│   │   │   ├── locales/    # Translation files
│   │   │   └── index.js
│   │   ├── services/        # API and Socket.IO services
│   │   ├── App.js
│   │   └── index.js
│   ├── .env.example
│   └── package.json
│
├── server/                    # Node.js backend
│   ├── config/              # Configuration files
│   │   └── database.js      # Sequelize configuration
│   ├── database/            # Database scripts
│   │   └── schema.sql       # Database schema
│   ├── middleware/          # Express middlewares
│   │   ├── auth.js          # JWT authentication
│   │   ├── errorHandler.js  # Error handling
│   │   ├── security.js      # Security measures
│   │   └── validation.js    # Input validation
│   ├── models/              # Sequelize models
│   │   ├── User.js
│   │   ├── Room.js
│   │   ├── Message.js
│   │   ├── File.js
│   │   └── index.js
│   ├── routes/              # API routes
│   │   ├── auth.js
│   │   ├── rooms.js
│   │   ├── messages.js
│   │   ├── files.js
│   │   └── moderation.js
│   ├── socket/              # Socket.IO handlers
│   │   └── socketHandler.js
│   ├── uploads/             # Uploaded files (gitignored)
│   ├── .env.example
│   ├── index.js             # Server entry point
│   └── package.json
│
├── .gitignore
├── DISCLAIMER.md            # Legal disclaimer
├── LEGAL_NOTICE.md          # Legal notice
├── LICENSE                  # MIT License
├── README.md                # This file
└── package.json             # Root package.json
```

## 🔒 Security

### Implemented Security Measures

- ✅ **End-to-End Encryption**: AES-256-GCM for messages, RSA-2048 for key exchange
- ✅ **JWT Authentication**: Secure token-based authentication
- ✅ **Rate Limiting**: Protection against spam and DDoS
- ✅ **Abuse Detection**: Automatic IP blacklisting
- ✅ **Input Validation**: Protection against XSS and SQL injection
- ✅ **CSRF Protection**: Cross-site request forgery protection
- ✅ **Room Isolation**: Complete message isolation between rooms
- ✅ **Audit Logging**: Complete audit trail of all actions
- ✅ **Security Headers**: Helmet.js for HTTP security headers
- ✅ **Password Hashing**: bcrypt with salt rounds

### Production Security Checklist

Before deploying to production, ensure:

- [ ] **HTTPS enabled** (SSL/TLS certificates)
- [ ] **Strong JWT_SECRET** (minimum 32 characters, randomly generated)
- [ ] **Secure MySQL** (strong password, restricted access)
- [ ] **Rate limiting configured** (appropriate limits for your use case)
- [ ] **Logging configured** (error tracking, monitoring)
- [ ] **Monitoring setup** (Sentry, DataDog, etc.)
- [ ] **Automatic MySQL backups** (daily backups recommended)
- [ ] **Firewall configured** (restrict database access)
- [ ] **Private keys stored securely** (not in code or environment variables)
- [ ] **Environment variables secured** (use secret management)
- [ ] **Regular security updates** (keep dependencies updated)
- [ ] **Security audit** (regular penetration testing)

### Security Best Practices

1. **Never commit sensitive data**:
   - `.env` files
   - Private keys
   - Passwords
   - API keys

2. **Use strong secrets**:
   ```bash
   # Generate secure random strings
   openssl rand -base64 32
   ```

3. **Keep dependencies updated**:
   ```bash
   npm audit
   npm audit fix
   ```

4. **Regular security reviews**:
   - Review access logs
   - Monitor for suspicious activity
   - Update security patches

## 🧪 Development

### Available Scripts

**Root level:**
```bash
npm run dev              # Start both server and client in development
npm run dev:server       # Start only the server
npm run dev:client       # Start only the client
npm run build            # Build client for production
npm run start            # Start server in production mode
npm run install:all      # Install all dependencies (root, server, client)
```

**Server:**
```bash
cd server
npm run dev              # Start with nodemon (auto-reload)
npm start                # Start in production mode
```

**Client:**
```bash
cd client
npm start                # Start development server
npm run build            # Build for production
```

### Development Workflow

1. **Fork and clone** the repository
2. **Create a branch** for your feature: `git checkout -b feature/your-feature`
3. **Make changes** and test locally
4. **Commit** your changes: `git commit -m "Add your feature"`
5. **Push** to your fork: `git push origin feature/your-feature`
6. **Open a Pull Request** on GitHub

### Code Style

- Use **ESLint** for code linting
- Follow **React best practices**
- Write **comprehensive comments** (in English)
- Use **descriptive variable names**
- Follow **async/await** patterns (avoid callbacks)

## 🚀 Deployment

### Production Deployment

1. **Build the client**:
```bash
cd client
npm run build
```

2. **Set production environment variables**:
```bash
# server/.env
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
# ... other production settings
```

3. **Start the server**:
```bash
cd server
npm start
```

### Environment-Specific Configuration

- **Development**: `NODE_ENV=development`
- **Production**: `NODE_ENV=production`
- **Testing**: `NODE_ENV=test`

## ⚖️ Legal

### Important Legal Information

**⚠️ READ THE DISCLAIMER BEFORE USING THIS SOFTWARE**

This software is provided "AS IS" without any warranties. See [DISCLAIMER.md](DISCLAIMER.md) for complete legal information.

**Key points:**
- No warranties or guarantees
- Limited liability
- Security disclaimers
- Illegal use prohibition
- Data privacy compliance responsibility
- No technical support guarantee

### Legal Documents

- **[DISCLAIMER.md](DISCLAIMER.md)**: Complete legal disclaimer and terms of use
- **[LEGAL_NOTICE.md](LEGAL_NOTICE.md)**: Legal notice and user agreement
- **[LICENSE](LICENSE)**: MIT License
- **Legal pages** (in `client/public/`):
  - `legal.html`: Legal mentions
  - `cgu.html`: Terms of service
  - `privacy.html`: Privacy policy

### Your Responsibilities

When using SecureChat, you are responsible for:

- ✅ Ensuring compliance with applicable laws (GDPR, CCPA, etc.)
- ✅ Obtaining necessary user consents
- ✅ Implementing appropriate data retention policies
- ✅ Securing your deployment
- ✅ Regular security audits
- ✅ Not using the software for illegal purposes

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/AmazingFeature`
3. **Make your changes** and test thoroughly
4. **Commit** your changes: `git commit -m 'Add some AmazingFeature'`
5. **Push** to your branch: `git push origin feature/AmazingFeature`
6. **Open a Pull Request**

### Contribution Guidelines

- Write **clear commit messages**
- Add **comments** to complex code (in English)
- Update **documentation** if needed
- Follow **existing code style**
- Write **tests** for new features
- Ensure **no breaking changes** (or document them)

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## ⚠️ Important Warnings

### Before Production Use

- ⚠️ **Configure HTTPS** (SSL/TLS certificates required)
- ⚠️ **Set strong secrets** (JWT_SECRET, DB_PASSWORD)
- ⚠️ **Secure your database** (strong password, restricted access)
- ⚠️ **Review security settings** (rate limits, blacklists)
- ⚠️ **Read the disclaimer** ([DISCLAIMER.md](DISCLAIMER.md))

### Never Commit

- ❌ `.env` files
- ❌ Private keys
- ❌ Passwords
- ❌ API keys
- ❌ Uploaded files

## 📧 Support

For questions, issues, or contributions:

- **GitHub Issues**: [Open an issue](https://github.com/luuuccasss/SecureChat/issues)
- **GitHub Repository**: [https://github.com/luuuccasss/SecureChat](https://github.com/luuuccasss/SecureChat)
- **Documentation**: See project documentation files
- **Security**: Report security issues privately

---

**Made with ❤️ for security and privacy**

**⚠️ Remember: Read [DISCLAIMER.md](DISCLAIMER.md) before using this software.**
