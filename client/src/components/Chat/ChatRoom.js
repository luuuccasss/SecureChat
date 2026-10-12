import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import socketService from '../../services/socketService';
import cryptoSession from '../../crypto/session';
import { messagesAPI, filesAPI, roomsAPI } from '../../services/api';
import { useTranslation } from '../../i18n';
import './ChatRoom.css';

// Decrypts one message from the server. The ciphertext is kept in `raw`, so the
// message can be decrypted again once a missing room key arrives.
const openMessage = async (roomId, raw) => {
  const plaintext = await cryptoSession.decryptText(roomId, raw);
  const base = { ...raw, raw };
  if (plaintext === null) {
    const missingKey = !cryptoSession.key(roomId, raw.keyVersion);
    return { ...base, content: null, locked: missingKey ? 'missing' : 'invalid' };
  }
  if (raw.type === 'file') {
    // File name, type and size are encrypted inside the message
    try {
      const meta = JSON.parse(plaintext);
      return { ...base, content: null, fileMeta: meta };
    } catch {
      return { ...base, content: null, locked: 'invalid' };
    }
  }
  return { ...base, content: plaintext };
};

const ChatRoom = ({ room, user }) => {
  const { t, language } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [keyReady, setKeyReady] = useState(true);
  const [memberKeys, setMemberKeys] = useState(null);
  const pendingRef = useRef(null); // last message sent, re-sent once if its key was stale
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Sélectionner la locale date-fns selon la langue
  const dateLocale = language === 'fr' ? fr : enUS;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = useCallback(async () => {
    if (!room) return;

    try {
      setLoading(true);
      // Fetches our room keys first (and creates the first one in a new room)
      setKeyReady(!!(await cryptoSession.syncRoom(room.id)));
      const response = await messagesAPI.getByRoom(room.id, { limit: 50 });
      setMessages(await Promise.all(response.data.messages.map(msg => openMessage(room.id, msg))));
    } catch (error) {
      console.error('Erreur lors du chargement des messages:', error);
    } finally {
      setLoading(false);
    }
  }, [room]);

  // A room key arrived (shared by a member or rotated): decrypt what was locked
  const refreshKeys = useCallback(async () => {
    setKeyReady(!!(await cryptoSession.syncRoom(room.id)));
    const current = messagesRef.current;
    const reopened = await Promise.all(current.map(msg => (msg.locked ? openMessage(room.id, msg.raw) : msg)));
    setMessages(reopened);
  }, [room]);

  const messagesRef = useRef([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!room) return;

    // Rejoindre la room via Socket.IO
    socketService.joinRoom(room.id);

    // Charger les messages
    loadMessages();

    // Écouter les événements Socket.IO
    const handleNewMessage = async (data) => {
      if (data.message.room !== room.id) return;
      const messageToAdd = await openMessage(room.id, data.message);
      if (messageToAdd.sender?.id === user.id) pendingRef.current = null;

      setMessages(prev => {
        // Vérifier si le message existe déjà par son ID (évite les doublons)
        const existingIndex = prev.findIndex(msg => msg.id === messageToAdd.id);
        if (existingIndex !== -1) {
          // Le message existe déjà, le remplacer (mise à jour)
          const newMessages = [...prev];
          newMessages[existingIndex] = messageToAdd;
          return newMessages;
        }
        
        // Si c'est notre propre message, remplacer le message temporaire
        if (messageToAdd.sender?.id === user.id) {
          // Trouver et remplacer le dernier message temporaire de cet utilisateur
          let tempIndex = -1;
          for (let i = prev.length - 1; i >= 0; i--) {
            const msg = prev[i];
            if ((msg.isTemp || msg.id?.toString().startsWith('temp-')) && 
                msg.sender?.id === user.id) {
              tempIndex = i;
              break;
            }
          }
          if (tempIndex !== -1) {
            // Remplacer le message temporaire par le vrai message
            const newMessages = [...prev];
            newMessages[tempIndex] = messageToAdd;
            return newMessages;
          }
        }
        
        // Ajouter le nouveau message (message d'un autre utilisateur ou nouveau message)
        return [...prev, messageToAdd];
      });
      scrollToBottom();
    };

    const handleTyping = (data) => {
      if (data.userId === user.id) return;

      setTypingUsers(prev => {
        if (data.isTyping) {
          return prev.filter(u => u.userId !== data.userId).concat([data]);
        } else {
          return prev.filter(u => u.userId !== data.userId);
        }
      });
    };

    const handleUserJoined = (data) => {
      if (data.userId !== user.id) {
        setOnlineUsers(prev => {
          if (!prev.includes(data.userId)) {
            return [...prev, data.userId];
          }
          return prev;
        });
      }
    };

    const handleUserLeft = (data) => {
      setOnlineUsers(prev => prev.filter(id => id !== data.userId));
    };

    const handleRoomUsers = (data) => {
      if (data.roomId === room.id) {
        setOnlineUsers(data.users);
      }
    };


    const handleKeyEvent = (data) => {
      if (data.roomId === room.id) refreshKeys();
    };

    // Our message used a key version that is no longer current: re-sync and resend once
    const handleSocketError = async (data) => {
      if (data?.code !== 'STALE_KEY' || data.roomId !== room.id) return;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (!pending) return;
      const payload = await cryptoSession.encryptText(room.id, pending.plaintext);
      if (payload) socketService.sendMessage(room.id, payload, pending.type, pending.file);
    };

    socketService.on('new_message', handleNewMessage);
    socketService.on('room_key_shared', handleKeyEvent);
    socketService.on('room_key_rotated', handleKeyEvent);
    socketService.on('error', handleSocketError);
    socketService.on('typing', handleTyping);
    socketService.on('user_joined', handleUserJoined);
    socketService.on('user_left', handleUserLeft);
    socketService.on('room_users', handleRoomUsers);

    return () => {
      socketService.leaveRoom(room.id);
      socketService.off('new_message', handleNewMessage);
      socketService.off('room_key_shared', handleKeyEvent);
      socketService.off('room_key_rotated', handleKeyEvent);
      socketService.off('error', handleSocketError);
      socketService.off('typing', handleTyping);
      socketService.off('user_joined', handleUserJoined);
      socketService.off('user_left', handleUserLeft);
      socketService.off('room_users', handleRoomUsers);
    };
  }, [room, user, loadMessages, refreshKeys]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      setSending(true);

      // Chiffrer le message avec la clé actuelle de la room
      const payload = await cryptoSession.encryptText(room.id, messageContent);
      if (!payload) {
        setKeyReady(false);
        setNewMessage(messageContent);
        return;
      }

      // Ajouter le message localement (optimistic update) avec un ID temporaire unique
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      setMessages(prev => [...prev, {
        id: tempId,
        sender: { id: user.id, username: user.username },
        content: messageContent,
        type: 'text',
        createdAt: new Date(),
        isTemp: true
      }]);
      scrollToBottom();

      pendingRef.current = { plaintext: messageContent, type: 'text', file: null };
      socketService.sendMessage(room.id, payload, 'text');
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
          alert(t('errors.network'));
      // Remettre le message dans l'input en cas d'erreur
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  // Fingerprints of the members' public keys, to compare out of band
  const toggleMemberKeys = async () => {
    if (memberKeys) {
      setMemberKeys(null);
      return;
    }
    const { data } = await roomsAPI.getPublicKeys(room.id);
    setMemberKeys(await Promise.all(data.members.map(async m => ({
      ...m,
      fingerprint: await cryptoSession.fingerprint(m.publicKey)
    }))));
  };

  const handleTyping = () => {
    socketService.setTyping(room.id, true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      socketService.setTyping(room.id, false);
    }, 3000);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validation du type de fichier côté client
    const allowedTypes = (process.env.REACT_APP_ALLOWED_FILE_TYPES || 'image/*,.pdf,.doc,.docx,.txt')
      .split(',')
      .map(type => type.trim().toLowerCase());
    
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const maxSize = parseInt(process.env.REACT_APP_MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
    
    // Vérifier la taille
    if (file.size > maxSize) {
      alert(`Le fichier est trop volumineux. Taille maximum: ${(maxSize / 1024 / 1024).toFixed(2)} MB`);
      return;
    }
    
    // Vérifier le type (simplifié - accepter si extension correspond ou si image/*)
    const isValidType = allowedTypes.some(type => {
      if (type === 'image/*') {
        return file.type.startsWith('image/');
      }
      if (type.startsWith('.')) {
        return fileExt === type.slice(1);
      }
      return fileExt === type;
    });
    
    if (!isValidType && allowedTypes.length > 0 && !allowedTypes.includes('*')) {
      alert(`Type de fichier non autorisé. Types autorisés: ${allowedTypes.join(', ')}`);
      return;
    }

    try {
      setSending(true);

      // Chiffrer le fichier : le serveur ne reçoit qu'un blob opaque
      const sealed = await cryptoSession.encryptFile(room.id, file);
      if (!sealed) {
        setKeyReady(false);
        return;
      }
      const formData = new FormData();
      formData.append('iv', sealed.iv);
      formData.append('checksum', sealed.checksum);
      formData.append('file', new Blob([sealed.data], { type: 'application/octet-stream' }), 'encrypted.bin');
      const response = await filesAPI.upload(room.id, formData);

      // Le nom, le type et la taille réels voyagent chiffrés dans le message
      const meta = JSON.stringify({ name: file.name, mime: file.type, size: file.size, keyVersion: sealed.keyVersion });
      const payload = await cryptoSession.encryptText(room.id, meta);
      const fileRef = { id: response.data.file.id };
      pendingRef.current = { plaintext: meta, type: 'file', file: fileRef };
      socketService.sendMessage(room.id, payload, 'file', fileRef);

      setNewMessage('');
    } catch (error) {
      console.error('Erreur lors de l\'upload du fichier:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Erreur lors de l\'upload du fichier';
      console.error('Détails de l\'erreur:', {
        message: errorMessage,
        response: error.response?.data,
        status: error.response?.status
      });
      alert(errorMessage);
    } finally {
      setSending(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="chat-room">
      <div className="chat-header">
        <div>
          <h2>{room.name}</h2>
          {room.description && <p className="room-description">{room.description}</p>}
        </div>
        <div className="chat-header-actions">
          <button type="button" className="verify-keys-btn" onClick={toggleMemberKeys}>
            🔑 {t('chat.verifyKeys')}
          </button>
          <div className="online-indicator">
            <span className="online-dot"></span>
            <span>{onlineUsers.length} {t('chat.online')}</span>
          </div>
        </div>
      </div>

      {memberKeys && (
        <div className="key-panel">
          <p className="key-panel-help">{t('chat.fingerprintHelp')}</p>
          <ul>
            {memberKeys.map(m => (
              <li key={m.userId}>
                <span className="key-panel-user">{m.userId === user.id ? t('chat.you') : m.username}</span>
                <code>{m.fingerprint}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!keyReady && <div className="key-waiting">🔒 {t('chat.waitingForKey')}</div>}

      <div className="messages-container">
        {loading ? (
          <div className="loading-messages">{t('chat.loadingMessages')}</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">{t('chat.noMessages')}</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.sender.id === user.id ? 'own' : 'other'}`}
            >
              <div className="message-content">
                {message.locked ? (
                  <p className="message-locked">
                    🔒 {message.locked === 'missing' ? t('chat.waitingForKey') : t('errors.decryptionError')}
                  </p>
                ) : message.fileMeta ? (
                  <div className="file-message">
                    <button
                      type="button"
                      className="file-link"
                      onClick={async () => {
                        try {
                          const response = await filesAPI.download(message.file.id);
                          const bytes = new Uint8Array(await response.data.arrayBuffer());
                          const iv = response.headers['x-file-iv'] || message.file.iv;
                          const clear = await cryptoSession.decryptFile(
                            room.id,
                            { keyVersion: message.fileMeta.keyVersion, sender: message.sender },
                            bytes,
                            iv
                          );
                          const url = window.URL.createObjectURL(new Blob([clear], { type: message.fileMeta.mime || 'application/octet-stream' }));
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = message.fileMeta.name || 'file';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                        } catch (error) {
                          console.error('Erreur lors du téléchargement du fichier:', error);
                          alert(t('errors.fileDownloadError'));
                        }
                      }}
                    >
                      📎 {t('chat.download')} {message.fileMeta.name}
                    </button>
                    <span className="file-size">({(message.fileMeta.size / 1024).toFixed(2)} KB)</span>
                  </div>
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
              <div className="message-info">
                <span className="message-sender">
                  {message.sender.id === user.id ? t('chat.you') : message.sender.username}
                </span>
                <span className="message-time">
                  {format(new Date(message.createdAt), 'HH:mm', { locale: dateLocale })}
                </span>
              </div>
            </div>
          ))
        )}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            {typingUsers.map(u => u.username).join(', ')} {t('chat.typing')}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="input-container" onSubmit={handleSendMessage}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          accept={process.env.REACT_APP_ALLOWED_FILE_TYPES || 'image/*,.pdf,.doc,.docx,.txt'}
        />
        <button
          type="button"
          className="file-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          title={t('chat.uploadFile')}
        >
          📎
        </button>
        <input
          type="text"
          className="message-input"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          placeholder={t('chat.typeMessage')}
          disabled={sending}
        />
        <button type="submit" className="send-btn" disabled={sending || !keyReady || !newMessage.trim()}>
          {sending ? t('chat.sending') : t('chat.send')}
        </button>
      </form>
    </div>
  );
};

export default ChatRoom;

