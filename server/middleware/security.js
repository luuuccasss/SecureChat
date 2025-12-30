const { AuditLog } = require('../models');
const rateLimit = require('express-rate-limit');

// Blacklist IP en mémoire (en production, utiliser Redis)
const ipBlacklist = new Set();
const suspiciousIPs = new Map(); // IP -> { count, firstSeen, lastSeen }

/**
 * Détecte les activités suspectes
 */
const detectSuspiciousActivity = (req) => {
  const ip = req.ip || req.connection?.remoteAddress;
  if (!ip) return false;

  // Vérifier si l'IP est blacklistée
  if (ipBlacklist.has(ip)) {
    return true;
  }

  // Détecter les patterns suspects
  const userAgent = req.get('user-agent') || '';
  const suspiciousPatterns = [
    /bot|crawler|spider/i.test(userAgent) && !req.user, // Bot non authentifié
    req.path.includes('admin') && !req.user, // Tentative d'accès admin
    req.method === 'POST' && !req.user && req.path.includes('auth'), // Tentative de brute force
  ];

  return suspiciousPatterns.some(pattern => pattern === true);
};

/**
 * Enregistre une activité suspecte
 */
const logSuspiciousActivity = async (req, reason) => {
  const ip = req.ip || req.connection?.remoteAddress;
  if (!ip) return;

  const now = new Date();
  const suspicious = suspiciousIPs.get(ip) || { count: 0, firstSeen: now, lastSeen: now };
  
  suspicious.count++;
  suspicious.lastSeen = now;

  // Si trop d'activités suspectes, blacklister temporairement
  if (suspicious.count >= 10) {
    ipBlacklist.add(ip);
    console.warn(`⚠️ IP blacklistée: ${ip} (${suspicious.count} activités suspectes)`);
    
    // Logger dans audit
    await AuditLog.create({
      userId: null,
      roomId: null,
      action: 'ip_blacklisted',
      entityType: 'system',
      entityId: null,
      details: JSON.stringify({ ip, reason, count: suspicious.count }),
      ipAddress: ip,
      userAgent: req.get('user-agent')
    });

    // Retirer de la blacklist après 1 heure
    setTimeout(() => {
      ipBlacklist.delete(ip);
      suspiciousIPs.delete(ip);
      console.log(`✅ IP ${ip} retirée de la blacklist`);
    }, 60 * 60 * 1000);
  } else {
    suspiciousIPs.set(ip, suspicious);
  }

  // Logger l'activité suspecte
  await AuditLog.create({
    userId: req.user?.id || null,
    roomId: null,
    action: 'suspicious_activity',
    entityType: 'system',
    entityId: null,
    details: JSON.stringify({ ip, reason, path: req.path, method: req.method }),
    ipAddress: ip,
    userAgent: req.get('user-agent')
  });
};

/**
 * Middleware de sécurité
 */
const securityMiddleware = async (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress;

  // Vérifier la blacklist
  if (ip && ipBlacklist.has(ip)) {
    return res.status(403).json({ 
      error: 'Accès refusé',
      message: 'Votre adresse IP a été temporairement bloquée pour activité suspecte'
    });
  }

  // Détecter les activités suspectes
  if (detectSuspiciousActivity(req)) {
    await logSuspiciousActivity(req, 'Pattern suspect détecté');
    
    // Ne pas bloquer, juste logger (pour éviter les faux positifs)
    // En production, vous pouvez être plus strict
  }

  next();
};

/**
 * Rate limiter strict pour les routes sensibles
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requêtes max
  message: 'Trop de requêtes, veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Ne pas limiter les IPs whitelistées (si vous en avez)
    return false;
  },
  onLimitReached: async (req) => {
    const ip = req.ip || req.connection?.remoteAddress;
    await logSuspiciousActivity(req, 'Rate limit dépassé');
  }
});

/**
 * Rate limiter pour les tentatives de connexion
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives
  message: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes.',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  onLimitReached: async (req) => {
    await logSuspiciousActivity(req, 'Trop de tentatives de connexion');
  }
});

/**
 * Nettoyer les IPs suspectes anciennes (toutes les heures)
 */
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [ip, data] of suspiciousIPs.entries()) {
    if (data.lastSeen < oneHourAgo && data.count < 10) {
      suspiciousIPs.delete(ip);
    }
  }
}, 60 * 60 * 1000);

module.exports = {
  securityMiddleware,
  strictLimiter,
  loginLimiter,
  detectSuspiciousActivity,
  logSuspiciousActivity,
  ipBlacklist
};

