const errorHandler = (err, req, res, next) => {
  console.error('Erreur:', err);

  // Erreur de validation Sequelize
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => e.message);
    return res.status(400).json({ error: 'Erreur de validation', details: errors });
  }

  // Erreur de contrainte unique Sequelize
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors[0]?.path || 'champ';
    return res.status(400).json({ error: `${field} déjà utilisé` });
  }

  // Erreur de clé étrangère Sequelize
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({ error: 'Référence invalide' });
  }

  // Erreur de base de données Sequelize
  if (err.name === 'SequelizeDatabaseError') {
    return res.status(500).json({ error: 'Erreur de base de données' });
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token invalide' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expiré' });
  }

  // Upload errors (multer, malformed multipart) are client errors
  if (err.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: 'Fichier refusé', code: err.code });
  }
  if (/multipart|part header|boundary/i.test(err.message || '')) {
    return res.status(400).json({ error: 'Requête multipart invalide' });
  }

  // Body parser errors (invalid JSON, body too large) carry their own status
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(err.status).json({ error: err.type === 'entity.too.large' ? 'Requête trop volumineuse' : 'JSON invalide' });
  }

  // Erreur par défaut : en production, aucun détail interne ne sort du serveur
  const statusCode = err.statusCode || err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';
  const message = statusCode < 500 || isDev ? (err.message || 'Erreur') : 'Erreur serveur interne';

  res.status(statusCode).json({
    error: message,
    ...(isDev && { stack: err.stack })
  });
};

module.exports = { errorHandler };
