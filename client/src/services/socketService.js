import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  /**
   * Connecte au serveur Socket.IO
   */
  connect(token) {
    if (this.socket?.connected) {
      return;
    }

    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

    this.socket = io(socketUrl, {
      auth: {
        token: token || localStorage.getItem('token'),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('✅ Connecté au serveur Socket.IO');
      this.isConnected = true;
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Déconnecté du serveur:', reason);
      this.isConnected = false;
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Erreur de connexion Socket.IO:', error);
      this.emit('error', error);
    });

    // Écouter les événements génériques
    this.socket.onAny((event, ...args) => {
      this.emit(event, ...args);
    });
  }

  /**
   * Déconnecte du serveur
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Rejoint une room
   */
  joinRoom(roomId) {
    if (this.socket?.connected) {
      this.socket.emit('join_room', { roomId });
    }
  }

  /**
   * Quitte une room
   */
  leaveRoom(roomId) {
    if (this.socket?.connected) {
      this.socket.emit('leave_room', { roomId });
    }
  }

  /**
   * Envoie un message
   */
  sendMessage(roomId, content, iv, type = 'text', file = null) {
    if (this.socket?.connected) {
      this.socket.emit('send_message', {
        roomId,
        content,
        iv,
        type,
        file,
      });
    }
  }

  /**
   * Indique que l'utilisateur tape
   */
  setTyping(roomId, isTyping) {
    if (this.socket?.connected) {
      this.socket.emit('typing', { roomId, isTyping });
    }
  }

  /**
   * Marque un message comme lu
   */
  markAsRead(messageId) {
    if (this.socket?.connected) {
      this.socket.emit('mark_read', { messageId });
    }
  }

  /**
   * Demande la clé AES d'une room
   */
  requestRoomKey(roomId) {
    if (this.socket?.connected) {
      this.socket.emit('request_room_key', { roomId });
    }
  }

  /**
   * Partage la clé AES d'une room avec un utilisateur
   */
  shareRoomKey(roomId, userId, encryptedKey) {
    if (this.socket?.connected) {
      this.socket.emit('share_room_key', { roomId, userId, encryptedKey });
    }
  }

  /**
   * Écoute un événement
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Arrête d'écouter un événement
   */
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }

    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Émet un événement interne (pour les listeners locaux)
   */
  emit(event, ...args) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Erreur dans le listener pour ${event}:`, error);
        }
      });
    }
  }

  /**
   * Vérifie si connecté
   */
  get connected() {
    return this.isConnected && this.socket?.connected;
  }
}

// Instance singleton
const socketService = new SocketService();

export default socketService;

