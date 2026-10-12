// Authentication middleware for HTTP and Socket.IO
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_OPTIONS = { algorithms: ['HS256'] };

const signToken = (user) => jwt.sign(
  { userId: user.id, tv: user.tokenVersion },
  process.env.JWT_SECRET,
  { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
);

// Verifies the signature and that the token was not revoked by a logout
const verifyToken = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET, JWT_OPTIONS);
  const user = await User.findByPk(decoded.userId, {
    attributes: { exclude: ['password'] }
  });
  if (!user || decoded.tv !== user.tokenVersion) return null;
  return user;
};

// HTTP request authentication
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication token missing' });
    }

    const user = await verifyToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Socket.IO authentication
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication token missing'));
    }

    const user = await verifyToken(token);
    if (!user) {
      return next(new Error('Authentication failed'));
    }

    socket.userId = user.id.toString();
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
};

module.exports = { authenticate, authenticateSocket, signToken };
