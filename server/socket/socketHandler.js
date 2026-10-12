const { authenticateSocket } = require('../middleware/auth');
const { Room, Message, User, RoomMember, MessageRecipient } = require('../models');
const { hasKey, versionHasKeys } = require('../services/roomKeys');

// Message limits: clients never choose 'system', ciphertexts and IVs have a fixed shape
const CLIENT_MESSAGE_TYPES = ['text', 'file', 'image'];
const MAX_CIPHERTEXT_LENGTH = 20000;
const IV_PATTERN = /^[A-Za-z0-9+/]{16}$/; // 12-byte AES-GCM IV in base64

// Flood protection: at most RATE_MAX messages per RATE_WINDOW_MS per user
const RATE_WINDOW_MS = 10 * 1000;
const RATE_MAX = 10;
const sendHistory = new Map(); // userId -> timestamps of recent messages
const lastMessageInRoom = new Map(); // `${roomId}:${userId}` -> timestamp (slow mode)

const isFlooding = (userId) => {
  const now = Date.now();
  const recent = (sendHistory.get(userId) || []).filter(t => now - t < RATE_WINDOW_MS);
  recent.push(now);
  sendHistory.set(userId, recent);
  return recent.length > RATE_MAX;
};

// Stocker les utilisateurs en ligne par room
const roomUsers = new Map(); // roomId -> Set<userId>
const userRooms = new Map(); // userId -> Set<roomId>
const typingUsers = new Map(); // roomId -> Map<userId, timeout>

// Nettoyer les utilisateurs qui tapent après 3 secondes d'inactivité
const clearTyping = (roomId, userId) => {
  if (typingUsers.has(roomId)) {
    const roomTyping = typingUsers.get(roomId);
    if (roomTyping.has(userId)) {
      clearTimeout(roomTyping.get(userId));
      roomTyping.delete(userId);
    }
  }
};

module.exports = (io) => {
  // Middleware d'authentification Socket.IO
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`✅ Utilisateur connecté: ${socket.user.username} (${socket.userId})`);

    // Personal channel: wrapped room keys shared with this user are announced here
    socket.join(`user:${socket.userId}`);

    // Mettre à jour le statut en ligne
    User.update(
      {
        isOnline: true,
        lastSeen: new Date()
      },
      {
        where: { id: socket.userId }
      }
    );

    // Rejoindre une room
    socket.on('join_room', async (data) => {
      try {
        const { roomId } = data;

        if (!roomId) {
          return socket.emit('error', { message: 'roomId est requis' });
        }

        // Vérifier que l'utilisateur est membre de la room
        const room = await Room.findByPk(roomId);
        if (!room) {
          return socket.emit('error', { message: 'Room non trouvée' });
        }

        const isMember = await room.isMember(socket.userId);
        if (!isMember) {
          return socket.emit('error', { message: 'Vous n\'êtes pas membre de cette room' });
        }

        // Rejoindre la room Socket.IO
        socket.join(roomId.toString());

        // Ajouter à la liste des utilisateurs en ligne
        if (!roomUsers.has(roomId)) {
          roomUsers.set(roomId, new Set());
        }
        roomUsers.get(roomId).add(socket.userId);

        // Ajouter à la liste des rooms de l'utilisateur
        if (!userRooms.has(socket.userId)) {
          userRooms.set(socket.userId, new Set());
        }
        userRooms.get(socket.userId).add(roomId);

        // Notifier les autres utilisateurs
        socket.to(roomId.toString()).emit('user_joined', {
          userId: socket.userId,
          username: socket.user.username,
          timestamp: new Date()
        });

        // Envoyer la liste des utilisateurs en ligne
        const onlineUsers = Array.from(roomUsers.get(roomId));
        socket.emit('room_users', { roomId, users: onlineUsers });

        console.log(`👤 ${socket.user.username} a rejoint la room ${roomId}`);
      } catch (error) {
        console.error('Erreur join_room:', error);
        socket.emit('error', { message: 'Erreur lors de la connexion à la room' });
      }
    });

    // Quitter une room
    socket.on('leave_room', async (data) => {
      try {
        const { roomId } = data;

        if (roomId) {
          socket.leave(roomId.toString());

          // Retirer de la liste des utilisateurs en ligne
          if (roomUsers.has(roomId)) {
            roomUsers.get(roomId).delete(socket.userId);
            if (roomUsers.get(roomId).size === 0) {
              roomUsers.delete(roomId);
            }
          }

          // Retirer de la liste des rooms de l'utilisateur
          if (userRooms.has(socket.userId)) {
            userRooms.get(socket.userId).delete(roomId);
          }

          // Notifier les autres utilisateurs
          socket.to(roomId.toString()).emit('user_left', {
            userId: socket.userId,
            username: socket.user.username,
            timestamp: new Date()
          });

          console.log(`👋 ${socket.user.username} a quitté la room ${roomId}`);
        }
      } catch (error) {
        console.error('Erreur leave_room:', error);
      }
    });

    // Envoyer un message
    socket.on('send_message', async (data) => {
      try {
        const { roomId, content, type = 'text', iv, file, keyVersion } = data || {};

        if (!roomId || typeof content !== 'string' || typeof iv !== 'string') {
          return socket.emit('error', { message: 'Données de message incomplètes' });
        }
        if (!CLIENT_MESSAGE_TYPES.includes(type)) {
          return socket.emit('error', { message: 'Type de message invalide' });
        }
        if (content.length === 0 || content.length > MAX_CIPHERTEXT_LENGTH || !IV_PATTERN.test(iv)) {
          return socket.emit('error', { message: 'Message invalide' });
        }
        if (isFlooding(socket.userId)) {
          return socket.emit('error', { message: 'Trop de messages, veuillez ralentir' });
        }

        // Vérifier que l'utilisateur est membre de la room
        const room = await Room.findByPk(roomId);
        if (!room) {
          return socket.emit('error', { message: 'Room non trouvée' });
        }

        const role = await room.getUserRole(socket.userId);
        if (!role) {
          return socket.emit('error', { message: 'Vous n\'êtes pas membre de cette room' });
        }

        // Read-only rooms and slow mode apply to regular members only
        const isModerator = role === 'owner' || role === 'admin';
        if (room.readOnly && !isModerator) {
          return socket.emit('error', { message: 'Cette room est en lecture seule' });
        }
        if (room.slowMode > 0 && !isModerator) {
          const key = `${room.id}:${socket.userId}`;
          const last = lastMessageInRoom.get(key) || 0;
          if (Date.now() - last < room.slowMode * 1000) {
            return socket.emit('error', { message: `Mode lent : un message toutes les ${room.slowMode} secondes` });
          }
          lastMessageInRoom.set(key, Date.now());
        }

        // The message must use the current room key, which the sender must hold:
        // after a member left, senders first create a new key version
        if (keyVersion !== room.keyVersion || !(await hasKey(room.id, socket.userId, keyVersion))) {
          return socket.emit('error', { message: 'Clé de room périmée', code: 'STALE_KEY', roomId: room.id });
        }

        // Obtenir tous les membres de la room
        const members = await RoomMember.findAll({
          where: { roomId: room.id }
        });

        // File metadata always comes from the uploaded file record, never from the payload
        let fileRecord = null;
        if (type !== 'text') {
          const File = require('../models/File');
          fileRecord = file?.id ? await File.findOne({ where: { id: file.id, roomId: room.id } }) : null;
          if (!fileRecord) {
            return socket.emit('error', { message: 'Fichier introuvable' });
          }
        }

        // Créer le message
        const message = await Message.create({
          roomId: room.id,
          senderId: socket.userId,
          content,
          type,
          iv,
          keyVersion,
          encrypted: true,
          fileId: fileRecord ? fileRecord.id : null,
          fileOriginalName: fileRecord ? fileRecord.originalName : null,
          fileMimeType: fileRecord ? fileRecord.mimeType : null,
          fileSize: fileRecord ? fileRecord.size : null,
          fileEncrypted: true
        });

        // Créer les destinataires
        const recipients = members.map(member => ({
          messageId: message.id,
          userId: member.userId,
          delivered: member.userId.toString() === socket.userId.toString(),
          read: member.userId.toString() === socket.userId.toString(),
          deliveredAt: member.userId.toString() === socket.userId.toString() ? new Date() : null,
          readAt: member.userId.toString() === socket.userId.toString() ? new Date() : null
        }));

        await MessageRecipient.bulkCreate(recipients);

        // Charger le sender
        await message.reload({
          include: [
            { model: User, as: 'sender', attributes: ['id', 'username'] }
          ]
        });

        // Envoyer le message à tous les membres de la room
        io.to(roomId.toString()).emit('new_message', {
          message: {
            id: message.id,
            room: message.roomId,
            sender: {
              id: message.sender.id,
              username: message.sender.username
            },
            content: message.content,
            type: message.type,
            iv: message.iv,
            keyVersion: message.keyVersion,
            file: fileRecord ? { ...message.getFile(), iv: fileRecord.iv } : null,
            encrypted: message.encrypted,
            createdAt: message.createdAt
          }
        });

        // Marquer comme livré pour les utilisateurs en ligne
        const onlineMembers = Array.from(roomUsers.get(roomId) || []);
        for (const userId of onlineMembers) {
          if (userId !== socket.userId) {
            await message.markAsDelivered(userId);
          }
        }

        console.log(`💬 Message envoyé dans la room ${roomId} par ${socket.user.username}`);
      } catch (error) {
        console.error('Erreur send_message:', error);
        socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
      }
    });

    // A member without the current room key asks the online members to share it
    socket.on('request_room_key', async (data) => {
      try {
        const room = await Room.findByPk(data?.roomId);
        if (!room || !(await room.isMember(socket.userId))) return;
        if (await hasKey(room.id, socket.userId, room.keyVersion)) return;
        if (!(await versionHasKeys(room.id, room.keyVersion))) return; // a rotation is needed instead
        socket.to(String(room.id)).emit('room_key_needed', { roomId: room.id, userId: Number(socket.userId) });
      } catch (error) {
        console.error('Erreur request_room_key:', error);
      }
    });

    // Indicateur de frappe
    socket.on('typing', (data) => {
      try {
        const { roomId, isTyping } = data;

        if (!roomId) return;

        // Vérifier que l'utilisateur est dans la room
        if (!socket.rooms.has(roomId.toString())) return;

        if (isTyping) {
          // Ajouter l'utilisateur à la liste des utilisateurs qui tapent
          if (!typingUsers.has(roomId)) {
            typingUsers.set(roomId, new Map());
          }

          // Nettoyer le timeout précédent s'il existe
          clearTyping(roomId, socket.userId);

          // Créer un nouveau timeout
          const timeout = setTimeout(() => {
            clearTyping(roomId, socket.userId);
            socket.to(roomId.toString()).emit('typing', {
              userId: socket.userId,
              username: socket.user.username,
              isTyping: false
            });
          }, 3000);

          typingUsers.get(roomId).set(socket.userId, timeout);

          // Notifier les autres utilisateurs
          socket.to(roomId.toString()).emit('typing', {
            userId: socket.userId,
            username: socket.user.username,
            isTyping: true
          });
        } else {
          clearTyping(roomId, socket.userId);
          socket.to(roomId.toString()).emit('typing', {
            userId: socket.userId,
            username: socket.user.username,
            isTyping: false
          });
        }
      } catch (error) {
        console.error('Erreur typing:', error);
      }
    });

    // Marquer un message comme lu
    socket.on('mark_read', async (data) => {
      try {
        const { messageId } = data;

        if (!messageId) return;

        const message = await Message.findByPk(messageId);
        if (!message) return;

        // Vérifier que l'utilisateur est membre de la room
        const room = await Room.findByPk(message.roomId);
        if (!room) return;

        const isMember = await room.isMember(socket.userId);
        if (!isMember) return;

        await message.markAsRead(socket.userId);

        // Notifier l'expéditeur si présent
        io.to(message.roomId.toString()).emit('message_read', {
          messageId: message.id,
          userId: socket.userId,
          username: socket.user.username
        });
      } catch (error) {
        console.error('Erreur mark_read:', error);
      }
    });

    // Déconnexion
    socket.on('disconnect', async () => {
      try {
        console.log(`❌ Utilisateur déconnecté: ${socket.user.username} (${socket.userId})`);

        // Mettre à jour le statut hors ligne
        await User.update(
          {
            isOnline: false,
            lastSeen: new Date()
          },
          {
            where: { id: socket.userId }
          }
        );

        // Retirer de toutes les rooms
        if (userRooms.has(socket.userId)) {
          const rooms = Array.from(userRooms.get(socket.userId));
          rooms.forEach(roomId => {
            socket.leave(roomId.toString());

            if (roomUsers.has(roomId)) {
              roomUsers.get(roomId).delete(socket.userId);
              if (roomUsers.get(roomId).size === 0) {
                roomUsers.delete(roomId);
              }
            }

            // Notifier les autres utilisateurs
            socket.to(roomId.toString()).emit('user_left', {
              userId: socket.userId,
              username: socket.user.username,
              timestamp: new Date()
            });
          });

          userRooms.delete(socket.userId);
        }

        // Nettoyer les indicateurs de frappe
        typingUsers.forEach((roomTyping, roomId) => {
          if (roomTyping.has(socket.userId)) {
            clearTyping(roomId, socket.userId);
            socket.to(roomId.toString()).emit('typing', {
              userId: socket.userId,
              username: socket.user.username,
              isTyping: false
            });
          }
        });
      } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
      }
    });
  });

  return io;
};
