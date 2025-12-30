/**
 * SecureChat Server Entry Point
 * 
 * This file initializes the Express server, Socket.IO, database connection,
 * and all middleware/route handlers for the SecureChat application.
 * 
 * @requires dotenv - Environment variable configuration
 * @requires express - Web framework for Node.js
 * @requires socket.io - Real-time bidirectional event-based communication
 * @requires sequelize - MySQL ORM for database operations
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('./config/database');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Route handlers
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const fileRoutes = require('./routes/files');

// Socket.IO handler and error middleware
const socketHandler = require('./socket/socketHandler');
const { errorHandler } = require('./middleware/errorHandler');

// Initialize Express application and HTTP server
const app = express();
const server = http.createServer(app);

/**
 * Socket.IO Server Configuration
 * 
 * Configured with CORS to allow connections from the frontend.
 * Ping timeout and interval are set to maintain stable connections.
 */
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000, // 60 seconds
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000  // 25 seconds
});

/**
 * Security Middleware
 * 
 * Helmet helps secure Express apps by setting various HTTP headers.
 * Content Security Policy is disabled for Socket.IO compatibility.
 */
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for Socket.IO
  crossOriginEmbedderPolicy: false
}));

/**
 * CORS Configuration
 * 
 * Allows cross-origin requests from the configured frontend URL.
 * Credentials are enabled for cookie-based authentication.
 */
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

/**
 * Body Parser Middleware
 * 
 * Parses incoming request bodies in JSON and URL-encoded formats.
 * Limit set to 10MB to accommodate file uploads.
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Security Middleware
 * 
 * Implements abuse detection and IP blacklisting functionality.
 * Monitors request patterns and blocks suspicious activity.
 */
const { securityMiddleware } = require('./middleware/security');
app.use(securityMiddleware);

/**
 * Rate Limiting
 * 
 * Prevents abuse by limiting the number of requests per IP address.
 * Default: 100 requests per 15-minute window.
 */
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 100 requests per IP
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

/**
 * API Routes
 * 
 * Mount route handlers for different API endpoints:
 * - /api/auth: Authentication (login, register, verify)
 * - /api/rooms: Room management (create, join, list)
 * - /api/messages: Message operations (send, retrieve, mark as read)
 * - /api/files: File upload and download
 * - /api/moderation: Moderation features (ban, unban, audit logs)
 */
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/moderation', require('./routes/moderation'));

/**
 * Health Check Endpoint
 * 
 * Simple endpoint to verify server is running and responsive.
 * Returns server status and current timestamp.
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Error Handler Middleware
 * 
 * Catches all errors and formats them appropriately before sending response.
 * Should be the last middleware in the chain.
 */
app.use(errorHandler);

/**
 * Environment Variable Validation
 * 
 * Ensures required environment variables are set before starting the server.
 * Exits with error message if JWT_SECRET is missing.
 */
if (!process.env.JWT_SECRET) {
  console.error('❌ ERROR: JWT_SECRET is not defined in environment variables');
  console.error('📝 Create a server/.env file with at minimum:');
  console.error('   JWT_SECRET=your-jwt-secret-minimum-32-characters');
  console.error('   DB_NAME=securechat');
  console.error('   DB_USER=root');
  console.error('   DB_PASSWORD=your-database-password');
  console.error('\n💡 Copy server/.env.example to server/.env and fill in your values');
  process.exit(1);
}

/**
 * Database Connection and Server Startup
 * 
 * Connects to MySQL database, initializes Socket.IO handler,
 * and starts the HTTP server on the configured port.
 */
connectDB()
  .then(() => {
    // Initialize Socket.IO event handlers
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

/**
 * Graceful Shutdown Handler
 * 
 * Handles SIGTERM signal to gracefully close database connections
 * and HTTP server before process termination.
 */
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

