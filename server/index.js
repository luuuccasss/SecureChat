// SecureChat Server Entry Point
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('./config/database');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const fileRoutes = require('./routes/files');
const socketHandler = require('./socket/socketHandler');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Number of reverse proxies in front of the app (nginx, Cloudflare...), so that
// req.ip is the real client address and rate limits are applied per visitor.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY, 10) || process.env.TRUST_PROXY);
}
const server = http.createServer(app);

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000, // 60 seconds
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000, // 25 seconds
  maxHttpBufferSize: 64 * 1024 // a message is at most ~20 KB of ciphertext
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Messages go through Socket.IO and files through multipart, so JSON bodies stay small
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/moderation', require('./routes/moderation'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use(errorHandler);

// Refuse to start with a missing, short or example JWT secret: anyone who knows
// it can forge a token for any account
const EXAMPLE_SECRET = 'your-super-secret-jwt-key-minimum-32-characters-long';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === EXAMPLE_SECRET) {
  console.error('❌ ERROR: JWT_SECRET must be set to a random value of at least 32 characters');
  console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))"');
  process.exit(1);
}
if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error('❌ ERROR: DB_USER and DB_PASSWORD must be set in server/.env');
  process.exit(1);
}

// Connect to database and start server
connectDB()
  .then(() => {
    socketHandler(io);
    
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`🚀 Server started on port ${PORT}`);
      console.log(`📡 Socket.IO ready for connections`);
      console.log(`🌍 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
    });
  })
  .catch((err) => {
    console.error('❌ MySQL connection error:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    const { sequelize } = require('./config/database');
    await sequelize.close();
    console.log('MySQL connection closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };

