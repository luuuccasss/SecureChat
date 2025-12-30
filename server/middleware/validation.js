const { body, validationResult } = require('express-validator');

// Middleware pour gérer les résultats de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Erreur de validation', 
      details: errors.array() 
    });
  }
  next();
};

// Validations pour l'authentification
const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Le nom d\'utilisateur doit contenir entre 3 et 30 caractères')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'),
  body('publicKey')
    .notEmpty()
    .withMessage('La clé publique est requise'),
  handleValidationErrors
];

const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis'),
  handleValidationErrors
];

// Validations pour les rooms
const validateCreateRoom = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Le nom doit contenir entre 1 et 100 caractères'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La description ne peut pas dépasser 500 caractères'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate doit être un booléen'),
  handleValidationErrors
];

// Validations pour les messages
const validateMessage = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Le message doit contenir entre 1 et 10000 caractères'),
  body('iv')
    .notEmpty()
    .withMessage('L\'IV est requis pour le chiffrement'),
  handleValidationErrors
];

// Fonction pour échapper les caractères HTML (anti-XSS)
const escapeHtml = (text) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
};

module.exports = {
  validateRegister,
  validateLogin,
  validateCreateRoom,
  validateMessage,
  handleValidationErrors,
  escapeHtml
};

