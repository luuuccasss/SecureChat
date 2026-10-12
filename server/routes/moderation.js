const express = require('express');
const { Room, RoomMember, BannedUser, User, Message } = require('../models');
const { authenticate } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Vérifier si un utilisateur est banni
router.get('/rooms/:roomId/banned/:userId', async (req, res, next) => {
  try {
    const { roomId, userId } = req.params;
    const room = await Room.findByPk(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room non trouvée' });
    }

    // Only the user concerned or the room moderators may look up a ban
    const isSelf = String(userId) === String(req.user.id);
    const role = await room.getUserRole(req.user.id);
    const isModerator = role === 'owner' || role === 'admin';
    if (!isSelf && !isModerator) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }

    const ban = await BannedUser.findActive(roomId, userId);
    res.json(isModerator ? { banned: !!ban, ban: ban || null } : { banned: !!ban });
  } catch (error) {
    next(error);
  }
});

// Bannir un utilisateur
router.post('/rooms/:roomId/ban/:userId', async (req, res, next) => {
  try {
    const { roomId, userId } = req.params;
    const { reason, expiresAt } = req.body;

    // Vérifier les permissions
    const room = await Room.findByPk(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room non trouvée' });
    }

    const role = await room.getUserRole(req.user.id);
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }

    if (String(userId) === String(req.user.id)) {
      return res.status(400).json({ error: 'Impossible de se bannir soi-même' });
    }

    // A moderator can only ban users strictly below their own role
    const targetRole = await room.getUserRole(userId);
    if (Room.roleRank(targetRole) >= Room.roleRank(role)) {
      return res.status(403).json({ error: 'Impossible de bannir un membre de rang égal ou supérieur' });
    }

    let expiry = null;
    if (expiresAt) {
      expiry = new Date(expiresAt);
      if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
        return res.status(400).json({ error: 'Date d\'expiration invalide' });
      }
    }
    const cleanReason = typeof reason === 'string' ? reason.slice(0, 500) : null;

    // Créer ou mettre à jour le bannissement
    const [ban, created] = await BannedUser.findOrCreate({
      where: { roomId, userId },
      defaults: {
        roomId,
        userId,
        bannedBy: req.user.id,
        reason: cleanReason,
        expiresAt: expiry
      }
    });

    if (!created) {
      ban.bannedBy = req.user.id;
      ban.reason = cleanReason || ban.reason;
      ban.expiresAt = expiry;
      await ban.save();
    }

    // Retirer l'utilisateur de la room
    await RoomMember.destroy({
      where: { roomId, userId }
    });

    // Logger l'action
    await auditLog(req, 'ban_user', 'user', userId, {
      roomId,
      reason: cleanReason,
      expiresAt: expiry
    });

    res.json({ message: 'Utilisateur banni avec succès', ban });
  } catch (error) {
    next(error);
  }
});

// Débannir un utilisateur
router.delete('/rooms/:roomId/ban/:userId', async (req, res, next) => {
  try {
    const { roomId, userId } = req.params;

    // Vérifier les permissions
    const room = await Room.findByPk(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room non trouvée' });
    }

    const role = await room.getUserRole(req.user.id);
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }

    const ban = await BannedUser.findOne({ where: { roomId, userId } });
    if (!ban) {
      return res.status(404).json({ error: 'Aucun bannissement trouvé' });
    }

    // Admins can only lift the bans they issued themselves
    if (role !== 'owner' && String(ban.bannedBy) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Seul le propriétaire ou l\'auteur du bannissement peut le lever' });
    }

    await ban.destroy();

    // Logger l'action
    await auditLog(req, 'unban_user', 'user', userId, { roomId });

    res.json({ message: 'Utilisateur débanni avec succès' });
  } catch (error) {
    next(error);
  }
});

// Supprimer un message (modération)
router.delete('/messages/:messageId', async (req, res, next) => {
  try {
    const message = await Message.findByPk(req.params.messageId, {
      include: [{ model: Room, as: 'room' }]
    });

    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }

    // Vérifier les permissions
    const role = await message.room.getUserRole(req.user.id);
    // Authors can delete their own messages only while they are still members,
    // so a banned user cannot wipe the evidence
    const canDelete = role === 'owner' ||
                      role === 'admin' ||
                      (role !== null && message.senderId === req.user.id);

    if (!canDelete) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }

    await message.destroy();

    // Logger l'action
    await auditLog(req, 'delete_message', 'message', message.id, {
      roomId: message.roomId,
      senderId: message.senderId
    });

    res.json({ message: 'Message supprimé avec succès' });
  } catch (error) {
    next(error);
  }
});

// Changer le rôle d'un utilisateur
router.patch('/rooms/:roomId/members/:userId/role', async (req, res, next) => {
  try {
    const { roomId, userId } = req.params;
    const { role } = req.body;

    // Ownership cannot be shared: there is exactly one owner, the creator
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    const room = await Room.findByPk(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room non trouvée' });
    }

    // Seul le owner peut changer les rôles
    const userRole = await room.getUserRole(req.user.id);
    if (userRole !== 'owner') {
      return res.status(403).json({ error: 'Seul le propriétaire peut changer les rôles' });
    }

    // Ne pas permettre de changer le rôle du owner
    if (userId === room.creatorId.toString()) {
      return res.status(403).json({ error: 'Impossible de changer le rôle du propriétaire' });
    }

    const member = await RoomMember.findOne({
      where: { roomId, userId }
    });

    if (!member) {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    const oldRole = member.role;
    member.role = role;
    await member.save();

    // Logger l'action
    await auditLog(req, 'change_role', 'user', userId, {
      roomId,
      newRole: role,
      oldRole
    });

    res.json({ message: 'Rôle modifié avec succès', member });
  } catch (error) {
    next(error);
  }
});

// Obtenir les logs d'audit d'une room
router.get('/rooms/:roomId/audit-logs', async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const room = await Room.findByPk(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room non trouvée' });
    }

    // Seul le owner peut voir les logs
    const role = await room.getUserRole(req.user.id);
    if (role !== 'owner') {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }

    const { AuditLog } = require('../models');
    const logs = await AuditLog.findAll({
      where: { roomId },
      limit: Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100),
      offset: Math.max(parseInt(offset, 10) || 0, 0),
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['id', 'username'] }
      ]
    });

    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

