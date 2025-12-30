const express = require('express');
const { Room, RoomMember, BannedUser, User, Message } = require('../models');
const { authenticate } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { Op } = require('sequelize');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Vérifier si un utilisateur est banni
router.get('/rooms/:roomId/banned/:userId', async (req, res, next) => {
  try {
    const { roomId, userId } = req.params;

    const ban = await BannedUser.findOne({
      where: {
        roomId,
        userId,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } }
        ]
      }
    });

    res.json({ banned: !!ban, ban: ban || null });
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

    // Vérifier que l'utilisateur à bannir n'est pas owner
    const targetRole = await room.getUserRole(userId);
    if (targetRole === 'owner') {
      return res.status(403).json({ error: 'Impossible de bannir le propriétaire' });
    }

    // Créer ou mettre à jour le bannissement
    const [ban, created] = await BannedUser.findOrCreate({
      where: { roomId, userId },
      defaults: {
        roomId,
        userId,
        bannedBy: req.user.id,
        reason: reason || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }
    });

    if (!created) {
      ban.bannedBy = req.user.id;
      ban.reason = reason || ban.reason;
      ban.expiresAt = expiresAt ? new Date(expiresAt) : ban.expiresAt;
      await ban.save();
    }

    // Retirer l'utilisateur de la room
    await RoomMember.destroy({
      where: { roomId, userId }
    });

    // Logger l'action
    await auditLog(req, 'ban_user', 'user', userId, {
      roomId,
      reason,
      expiresAt
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

    await BannedUser.destroy({
      where: { roomId, userId }
    });

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
    const canDelete = role === 'owner' || 
                      role === 'admin' || 
                      (message.senderId === req.user.id);

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

    if (!['owner', 'admin', 'member'].includes(role)) {
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

    member.role = role;
    await member.save();

    // Logger l'action
    await auditLog(req, 'change_role', 'user', userId, {
      roomId,
      newRole: role,
      oldRole: member.previous('role')
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
      limit: parseInt(limit),
      offset: parseInt(offset),
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

