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
const server = http.createServer(app);

// Socket.IO avec CORS configuré
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middlewares de sécurité
app.use(helmet({
  contentSecurityPolicy: false, // Désactivé pour Socket.IO
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de sécurité (détection d'abus, blacklist IP)
const { securityMiddleware } = require('./middleware/security');
app.use(securityMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
});

app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/moderation', require('./routes/moderation'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Gestion des erreurs
app.use(errorHandler);

// Vérifier les variables d'environnement requises
if (!process.env.JWT_SECRET) {
  console.error('❌ ERREUR: JWT_SECRET n\'est pas défini dans les variables d\'environnement');
  console.error('📝 Créez un fichier server/.env avec au minimum:');
  console.error('   JWT_SECRET=votre-secret-jwt-min-32-caracteres');
  console.error('   DB_NAME=securechat');
  console.error('   DB_USER=root');
  console.error('   DB_PASSWORD=votre-mot-de-passe');
  process.exit(1);
}

// Connexion MySQL
connectDB()
  .then(() => {
    // Initialiser Socket.IO
    socketHandler(io);
    
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Erreur de connexion MySQL:', err);
    process.exit(1);
  });

// Gestion gracieuse de l'arrêt
process.on('SIGTERM', async () => {
  console.log('SIGTERM reçu, fermeture gracieuse...');
  server.close(async () => {
    const { sequelize } = require('./config/database');
    await sequelize.close();
    console.log('MySQL connexion fermée');
    process.exit(0);
  });
});

module.exports = { app, server, io };

