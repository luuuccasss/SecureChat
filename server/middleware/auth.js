/**
 * Authentication Middleware
 * 
 * Provides JWT-based authentication for HTTP requests and Socket.IO connections.
 * Validates JWT tokens and attaches user information to request/socket objects.
 * 
 * @module middleware/auth
 * @requires jsonwebtoken - JWT token verification
 * @requires models - Sequelize User model
 */

const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * HTTP Request Authentication Middleware
 * 
 * Validates JWT token from Authorization header and attaches user to request object.
 * Token format: "Bearer <token>"
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @returns {void} Calls next() on success, sends error response on failure
 * 
 * @example
 * router.get('/protected', authenticate, (req, res) => {
 *   res.json({ user: req.user });
 * });
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    // Format: "Bearer <token>"
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication token missing' });
    }

    // Verify and decode JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch user from database (excluding password)
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach user to request object for use in route handlers
    req.user = user;
    next();
  } catch (error) {
    // Handle different JWT error types
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Socket.IO Connection Authentication Middleware
 * 
 * Validates JWT token from Socket.IO handshake and attaches user to socket object.
 * Token can be provided in handshake.auth.token or Authorization header.
 * 
 * @param {Object} socket - Socket.IO socket object
 * @param {Function} next - Socket.IO next middleware function
 * 
 * @returns {void} Calls next() on success, calls next(error) on failure
 * 
 * @example
 * io.use(authenticateSocket);
 */
const authenticateSocket = async (socket, next) => {
  try {
    // Extract token from handshake (preferred) or Authorization header
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication token missing'));
    }

    // Verify and decode JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch user from database (excluding password)
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] }
    });
    
    if (!user) {
      return next(new Error('User not found'));
    }

    // Attach user information to socket for use in event handlers
    socket.userId = user.id.toString();
    socket.user = user;
    next();
  } catch (error) {
    // Generic error message for security (don't expose token details)
    next(new Error('Authentication failed'));
  }
};

module.exports = { authenticate, authenticateSocket };
