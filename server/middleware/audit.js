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

module.exports = { auditLog };

