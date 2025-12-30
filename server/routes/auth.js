const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');
const { Op } = require('sequelize');

const router = express.Router();

// Inscription
router.post('/register', authLimiter, validateRegister, async (req, res, next) => {
  try {
    const { username, email, password, publicKey } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ 
      where: {
        [Op.or]: [{ email }, { username }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: existingUser.email === email 
          ? 'Cet email est déjà utilisé' 
          : 'Ce nom d\'utilisateur est déjà utilisé' 
      });
    }

    // Créer l'utilisateur
    const user = await User.create({
      username,
      email,
      password,
      publicKey
    });

    // Générer le token JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'Inscription réussie',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        publicKey: user.publicKey
      }
    });
  } catch (error) {
    next(error);
  }
});

// Connexion
router.post('/login', authLimiter, validateLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Trouver l'utilisateur avec le mot de passe
    const user = await User.findOne({ 
      where: { email },
      attributes: { include: ['password'] }
    });

    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Mettre à jour le statut en ligne
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    // Générer le token JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        publicKey: user.publicKey,
        isOnline: user.isOnline
      }
    });
  } catch (error) {
    next(error);
  }
});

// Vérifier le token
router.get('/verify', authenticate, async (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      publicKey: req.user.publicKey
    }
  });
});

// Déconnexion
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (user) {
      user.isOnline = false;
      user.lastSeen = new Date();
      await user.save();
    }

    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    next(error);
  }
});

// Obtenir les informations publiques d'un utilisateur (pour l'échange de clés)
router.get('/user/:userId/public', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.userId, {
      attributes: ['id', 'username', 'publicKey']
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
      id: user.id,
      username: user.username,
      publicKey: user.publicKey
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
