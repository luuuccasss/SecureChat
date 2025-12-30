const express = require('express');
const { Room, RoomMember, User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { validateCreateRoom } = require('../middleware/validation');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Créer une room
router.post('/', validateCreateRoom, async (req, res, next) => {
  try {
    const { name, description, isPrivate, password, maxMembers } = req.body;

    // Hasher le mot de passe si fourni
    let hashedPassword = null;
    if (isPrivate && password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Créer la room
    const room = await Room.create({
      name,
      description: description || '',
      creatorId: req.user.id,
      isPrivate: isPrivate || false,
      password: hashedPassword,
      maxMembers: maxMembers || 100
    });

    // Ajouter le créateur comme owner
    await RoomMember.create({
      roomId: room.id,
      userId: req.user.id,
      role: 'owner'
    });

    // Charger les relations
    await room.reload({
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { 
          model: User, 
          as: 'members', 
          attributes: ['id', 'username'],
          through: { attributes: ['role', 'joinedAt'] }
        }
      ]
    });

    res.status(201).json({
      message: 'Room créée avec succès',
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        creator: room.creator,
        isPrivate: room.isPrivate,
        members: room.members.map(m => ({
          user: { id: m.id, username: m.username },
          role: m.RoomMember.role,
          joinedAt: m.RoomMember.joinedAt
        })),
        maxMembers: room.maxMembers,
        settings: {
          allowFileUpload: room.allowFileUpload,
          allowInvites: room.allowInvites
        },
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// Obtenir toutes les rooms publiques
router.get('/public', async (req, res, next) => {
  try {
    const rooms = await Room.findAll({
      where: { isPrivate: false },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { 
          model: User, 
          as: 'members', 
          attributes: ['id', 'username'],
          through: { attributes: ['role', 'joinedAt'] }
        }
      ],
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    const formattedRooms = rooms.map(room => ({
      id: room.id,
      name: room.name,
      description: room.description,
      creator: room.creator,
      isPrivate: room.isPrivate,
      members: room.members.map(m => ({
        user: { id: m.id, username: m.username },
        role: m.RoomMember.role,
        joinedAt: m.RoomMember.joinedAt
      })),
      maxMembers: room.maxMembers,
      settings: {
        allowFileUpload: room.allowFileUpload,
        allowInvites: room.allowInvites
      },
      createdAt: room.createdAt
    }));

    res.json({ rooms: formattedRooms });
  } catch (error) {
    next(error);
  }
});

// Obtenir les rooms de l'utilisateur
router.get('/my-rooms', async (req, res, next) => {
  try {
    const userRooms = await RoomMember.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Room,
          as: 'Room',
          include: [
            { model: User, as: 'creator', attributes: ['id', 'username'] },
            { 
              model: User, 
              as: 'members', 
              attributes: ['id', 'username'],
              through: { attributes: ['role', 'joinedAt'] }
            }
          ],
          attributes: { exclude: ['password'] }
        }
      ]
    });

    const rooms = userRooms.map(ur => {
      const room = ur.Room;
      return {
        id: room.id,
        name: room.name,
        description: room.description,
        creator: room.creator,
        isPrivate: room.isPrivate,
        members: room.members.map(m => ({
          user: { id: m.id, username: m.username },
          role: m.RoomMember.role,
          joinedAt: m.RoomMember.joinedAt
        })),
        maxMembers: room.maxMembers,
        settings: {
          allowFileUpload: room.allowFileUpload,
          allowInvites: room.allowInvites
        },
        createdAt: room.createdAt
      };
    });

    res.json({ rooms });
  } catch (error) {
    next(error);
  }
});

// Obtenir une room spécifique
router.get('/:roomId', async (req, res, next) => {
  try {
    const room = await Room.findByPk(req.params.roomId, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { 
          model: User, 
          as: 'members', 
          attributes: ['id', 'username'],
          through: { attributes: ['role', 'joinedAt'] }
        }
      ],
      attributes: { exclude: ['password'] }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room non trouvée' });
    }

    // Vérifier si l'utilisateur est membre
    const isMember = await room.isMember(req.user.id);
    if (!isMember) {
      return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette room' });
    }

    res.json({
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        creator: room.creator,
        isPrivate: room.isPrivate,
        members: room.members.map(m => ({
          user: { id: m.id, username: m.username },
          role: m.RoomMember.role,
          joinedAt: m.RoomMember.joinedAt
        })),
        maxMembers: room.maxMembers,
        settings: {
          allowFileUpload: room.allowFileUpload,
          allowInvites: room.allowInvites
        },
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// Rejoindre une room
router.post('/:roomId/join', async (req, res, next) => {
  try {
    const { password } = req.body;
    const room = await Room.findByPk(req.params.roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room non trouvée' });
    }

    // Vérifier si déjà membre
    const isMember = await room.isMember(req.user.id);
    if (isMember) {
      return res.status(400).json({ error: 'Vous êtes déjà membre de cette room' });
    }

    // Vérifier le mot de passe si la room est privée
    if (room.isPrivate) {
      if (!password) {
        return res.status(401).json({ error: 'Mot de passe requis' });
      }
      
      if (!room.password) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }

      const isPasswordValid = await bcrypt.compare(password, room.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
      }
    }

    // Vérifier la limite de membres
    const memberCount = await RoomMember.count({ where: { roomId: room.id } });
    if (memberCount >= room.maxMembers) {
      return res.status(400).json({ error: 'La room est pleine' });
    }

    // Ajouter le membre
    await RoomMember.create({
      roomId: room.id,
      userId: req.user.id,
      role: 'member'
    });

    // Recharger avec les relations
    await room.reload({
      include: [
        { 
          model: User, 
          as: 'members', 
          attributes: ['id', 'username'],
          through: { attributes: ['role', 'joinedAt'] }
        }
      ]
    });

    res.json({
      message: 'Vous avez rejoint la room',
      room: {
        id: room.id,
        name: room.name,
        members: room.members.map(m => ({
          user: { id: m.id, username: m.username },
          role: m.RoomMember.role,
          joinedAt: m.RoomMember.joinedAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Quitter une room
router.post('/:roomId/leave', async (req, res, next) => {
  try {
    const room = await Room.findByPk(req.params.roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room non trouvée' });
    }

    const isMember = await room.isMember(req.user.id);
    if (!isMember) {
      return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette room' });
    }

    // Ne pas permettre au propriétaire de quitter
    if (room.creatorId === req.user.id) {
      return res.status(400).json({ error: 'Le propriétaire ne peut pas quitter la room' });
    }

    // Retirer le membre
    await RoomMember.destroy({
      where: {
        roomId: room.id,
        userId: req.user.id
      }
    });

    res.json({ message: 'Vous avez quitté la room' });
  } catch (error) {
    next(error);
  }
});

// Supprimer une room (owner seulement)
router.delete('/:roomId', async (req, res, next) => {
  try {
    const room = await Room.findByPk(req.params.roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room non trouvée' });
    }

    if (room.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Seul le propriétaire peut supprimer la room' });
    }

    await room.destroy();

    res.json({ message: 'Room supprimée avec succès' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
