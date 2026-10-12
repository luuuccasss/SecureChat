const express = require('express');
const { Room, RoomMember, User, BannedUser, RoomKey } = require('../models');
const { sequelize } = require('../config/database');
const { isWrappedKey, hasKey, versionHasKeys, revokeMember, requestKeyFor } = require('../services/roomKeys');
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
    // The room starts without a key: the creator then creates key version 1
    // through POST /:roomId/keys/rotate, like any later key change
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

    // Banned users cannot come back until the ban expires or is lifted
    if (await BannedUser.findActive(room.id, req.user.id)) {
      return res.status(403).json({ error: 'Vous êtes banni de cette room' });
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

    // Online members wrap the current room key for the newcomer
    await requestKeyFor(req.app.get('io'), room.id, req.user.id);

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

    // Future messages use a key the former member never receives
    await revokeMember(req.app.get('io'), room, req.user.id);

    res.json({ message: 'Vous avez quitté la room' });
  } catch (error) {
    next(error);
  }
});

// Loads the room and checks membership, for the key routes below
const loadRoomAsMember = async (req, res) => {
  const room = await Room.findByPk(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: 'Room non trouvée' });
    return null;
  }
  if (!(await room.isMember(req.user.id))) {
    res.status(403).json({ error: 'Vous n\'êtes pas membre de cette room' });
    return null;
  }
  return room;
};

// Room keys wrapped for the current user, every version they were given
router.get('/:roomId/keys', async (req, res, next) => {
  try {
    const room = await loadRoomAsMember(req, res);
    if (!room) return;
    const keys = await RoomKey.findAll({
      where: { roomId: room.id, userId: req.user.id },
      attributes: ['version', 'wrappedKey'],
      order: [['version', 'ASC']]
    });
    res.json({
      keyVersion: room.keyVersion,
      // false means nobody holds the current version yet: a rotation is needed
      currentVersionHasKeys: await versionHasKeys(room.id, room.keyVersion),
      keys
    });
  } catch (error) {
    next(error);
  }
});

// Public keys of the members, used to wrap room keys for them
router.get('/:roomId/public-keys', async (req, res, next) => {
  try {
    const room = await loadRoomAsMember(req, res);
    if (!room) return;
    const members = await RoomMember.findAll({
      where: { roomId: room.id },
      include: [{ model: User, as: 'User', attributes: ['id', 'username', 'publicKey'] }]
    });
    res.json({
      members: members.map(m => ({ userId: m.User.id, username: m.User.username, publicKey: m.User.publicKey }))
    });
  } catch (error) {
    next(error);
  }
});

// Share a key version you hold with another member (e.g. someone who just joined)
router.post('/:roomId/keys', async (req, res, next) => {
  try {
    const room = await loadRoomAsMember(req, res);
    if (!room) return;
    const { userId, version, wrappedKey } = req.body;
    if (!Number.isInteger(userId) || !Number.isInteger(version) || !isWrappedKey(wrappedKey)) {
      return res.status(400).json({ error: 'Requête invalide' });
    }
    if (version < 1 || version > room.keyVersion || !(await hasKey(room.id, req.user.id, version))) {
      return res.status(403).json({ error: 'Vous ne détenez pas cette version de clé' });
    }
    if (!(await room.isMember(userId))) {
      return res.status(403).json({ error: 'Le destinataire n\'est pas membre de cette room' });
    }
    // First share wins: an existing key is never overwritten
    const [, created] = await RoomKey.findOrCreate({
      where: { roomId: room.id, userId, version },
      defaults: { roomId: room.id, userId, version, wrappedKey, createdBy: req.user.id }
    });
    if (!created) {
      return res.status(409).json({ error: 'Clé déjà partagée' });
    }
    req.app.get('io')?.to(`user:${userId}`).emit('room_key_shared', { roomId: room.id, version });
    res.status(201).json({ message: 'Clé partagée' });
  } catch (error) {
    next(error);
  }
});

// Create the current key version for every member at once (after someone left)
router.post('/:roomId/keys/rotate', async (req, res, next) => {
  try {
    const room = await loadRoomAsMember(req, res);
    if (!room) return;
    const { version, keys } = req.body;
    if (version !== room.keyVersion) {
      return res.status(409).json({ error: 'Version de clé périmée', keyVersion: room.keyVersion });
    }
    if (await versionHasKeys(room.id, version)) {
      return res.status(409).json({ error: 'Cette version de clé existe déjà', keyVersion: room.keyVersion });
    }

    // The new key must be wrapped for exactly the current members
    const memberIds = (await RoomMember.findAll({ where: { roomId: room.id }, attributes: ['userId'] }))
      .map(m => m.userId).sort((a, b) => a - b);
    const keyIds = Array.isArray(keys) ? keys.map(k => k?.userId).sort((a, b) => a - b) : [];
    const valid = Array.isArray(keys) && keys.every(k => Number.isInteger(k?.userId) && isWrappedKey(k?.wrappedKey));
    if (!valid || JSON.stringify(memberIds) !== JSON.stringify(keyIds)) {
      return res.status(400).json({ error: 'Les clés doivent couvrir exactement les membres actuels' });
    }

    try {
      await sequelize.transaction(t => RoomKey.bulkCreate(
        keys.map(k => ({ roomId: room.id, userId: k.userId, version, wrappedKey: k.wrappedKey, createdBy: req.user.id })),
        { transaction: t }
      ));
    } catch (error) {
      // Another member rotated at the same time
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'Cette version de clé existe déjà', keyVersion: room.keyVersion });
      }
      throw error;
    }

    req.app.get('io')?.to(String(room.id)).emit('room_key_rotated', { roomId: room.id, version });
    res.status(201).json({ message: 'Clé renouvelée', keyVersion: version });
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
