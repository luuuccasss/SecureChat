const { AuditLog } = require('../models');

/**
 * Middleware pour logger les actions importantes
 */
const auditLog = async (req, action, entityType, entityId, details = {}) => {
  try {
    await AuditLog.create({
      userId: req.user?.id || null,
      roomId: details.roomId || null,
      action,
      entityType,
      entityId,
      details: JSON.stringify(details),
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.get('user-agent') || null
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'audit log:', error);
    // Ne pas bloquer la requête en cas d'erreur de log
  }
};

/**
 * Middleware pour logger automatiquement certaines actions
 */
const auditMiddleware = (action, entityType) => {
  return async (req, res, next) => {
    // Logger après la réponse
    const originalSend = res.send;
    res.send = function(data) {
      if (res.statusCode < 400) {
        // Logger seulement les succès
        const entityId = req.params.id || req.params.roomId || req.params.messageId || req.params.fileId;
        auditLog(req, action, entityType, entityId, {
          method: req.method,
          path: req.path,
          body: req.body
        });
      }
      return originalSend.call(this, data);
    };
    next();
  };
};

module.exports = { auditLog, auditMiddleware };

