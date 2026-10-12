const express = require('express');
const { Message, Room, MessageRecipient } = require('../models');
const { authenticate } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Obtenir les messages d'une room
router.get('/room/:roomId', async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;

    // Vérifier que l'utilisateur est membre de la room
    const room = await Room.findByPk(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room non trouvée' });
    }

    const isMember = await room.isMember(req.user.id);
    if (!isMember) {
      return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette room' });
    }

    // Construire la requête
    const where = { roomId: roomId };
    if (before) {
      const beforeDate = new Date(before);
      if (Number.isNaN(beforeDate.getTime())) {
        return res.status(400).json({ error: 'Paramètre before invalide' });
      }
      where.createdAt = { [Op.lt]: beforeDate };
    }

    const messages = await Message.findAll({
      where,
      include: [
        { model: require('../models').User, as: 'sender', attributes: ['id', 'username'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100)
    });

    // Inverser pour avoir les plus anciens en premier
    messages.reverse();

    // Formater les messages
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      room: msg.roomId,
      sender: {
        id: msg.sender.id,
        username: msg.sender.username
      },
      content: msg.content,
      type: msg.type,
      iv: msg.iv,
      keyVersion: msg.keyVersion,
      file: msg.getFile(),
      encrypted: msg.encrypted,
      createdAt: msg.createdAt
    }));

    res.json({ messages: formattedMessages });
  } catch (error) {
    next(error);
  }
});

// Marquer un message comme lu
router.post('/:messageId/read', async (req, res, next) => {
  try {
    const message = await Message.findByPk(req.params.messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }

    await message.markAsRead(req.user.id);

    res.json({ message: 'Message marqué comme lu' });
  } catch (error) {
    next(error);
  }
});

// Marquer plusieurs messages comme lus
router.post('/read-multiple', async (req, res, next) => {
  try {
    const { messageIds } = req.body;

    if (!Array.isArray(messageIds) || messageIds.length > 100 || !messageIds.every(Number.isInteger)) {
      return res.status(400).json({ error: 'messageIds doit être un tableau de 100 identifiants au plus' });
    }

    await MessageRecipient.update(
      {
        read: true,
        readAt: new Date()
      },
      {
        where: {
          messageId: { [Op.in]: messageIds },
          userId: req.user.id,
          read: false
        }
      }
    );

    res.json({ message: 'Messages marqués comme lus' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
