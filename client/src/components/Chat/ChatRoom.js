import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import socketService from '../../services/socketService';
import cryptoService from '../../crypto/cryptoService';
import { messagesAPI, filesAPI } from '../../services/api';
import { useTranslation } from '../../i18n';
import './ChatRoom.css';

const ChatRoom = ({ room, user }) => {
  const { t, language } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
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
      const response = await messagesAPI.getByRoom(room.id, { limit: 50 });
      
      // Déchiffrer les messages
      const decryptedMessages = await Promise.all(
        response.data.messages.map(async (msg) => {
          try {
            if (msg.encrypted && msg.content && msg.iv) {
              const decrypted = await cryptoService.decryptMessage(
                msg.content,
                msg.iv,
                room.id
              );
              return { ...msg, content: decrypted, decrypted: true };
            }
            return msg;
          } catch (error) {
            console.error('Erreur lors du déchiffrement (loadMessages):', error);
            console.error('Message:', {
              id: msg.id,
              roomId: room.id,
              hasContent: !!msg.content,
              hasIv: !!msg.iv,
              encrypted: msg.encrypted,
              senderId: msg.senderId
            });
            return { ...msg, content: `[${t('errors.decryptionError')}]`, decrypted: false };
          }
        })
      );

      setMessages(decryptedMessages);
    } catch (error) {
      console.error('Erreur lors du chargement des messages:', error);
    } finally {
      setLoading(false);
    }
  }, [room]);

  useEffect(() => {
    if (!room) return;

    // Rejoindre la room via Socket.IO
    socketService.joinRoom(room.id);

    // Charger les messages
    loadMessages();

    // Écouter les événements Socket.IO
    const handleNewMessage = async (data) => {
      let messageToAdd = data.message;
      
      // Déchiffrer le message si nécessaire
      if (messageToAdd.encrypted && messageToAdd.content && messageToAdd.iv) {
        try {
          const decrypted = await cryptoService.decryptMessage(
            messageToAdd.content,
            messageToAdd.iv,
            room.id
          );
          messageToAdd = { ...messageToAdd, content: decrypted, decrypted: true };
        } catch (error) {
          console.error('Erreur lors du déchiffrement:', error);
          console.error('Message:', {
            id: messageToAdd.id,
            roomId: room.id,
            hasContent: !!messageToAdd.content,
            hasIv: !!messageToAdd.iv,
            encrypted: messageToAdd.encrypted
          });
          messageToAdd = { ...messageToAdd, content: `[${t('errors.decryptionError')}]`, decrypted: false };
        }
      }
      
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


    socketService.on('new_message', handleNewMessage);
    socketService.on('typing', handleTyping);
    socketService.on('user_joined', handleUserJoined);
    socketService.on('user_left', handleUserLeft);
    socketService.on('room_users', handleRoomUsers);

    return () => {
      socketService.leaveRoom(room.id);
      socketService.off('new_message', handleNewMessage);
      socketService.off('typing', handleTyping);
      socketService.off('user_joined', handleUserJoined);
      socketService.off('user_left', handleUserLeft);
      socketService.off('room_users', handleRoomUsers);
    };
  }, [room, user, loadMessages]);

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

      // Chiffrer le message
      const { encrypted, iv } = await cryptoService.encryptMessage(messageContent, room.id);

      // Ajouter le message localement (optimistic update) avec un ID temporaire unique
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempMessage = {
        id: tempId,
        sender: { id: user.id, username: user.username },
        content: messageContent,
        type: 'text',
        encrypted: true,
        createdAt: new Date(),
        decrypted: true,
        isTemp: true // Marqueur pour identifier les messages temporaires
      };
      setMessages(prev => [...prev, tempMessage]);
      scrollToBottom();

      // Envoyer via Socket.IO
      socketService.sendMessage(room.id, encrypted, iv, 'text');
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
          alert(t('errors.network'));
      // Remettre le message dans l'input en cas d'erreur
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
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

      // Chiffrer le fichier
      const { encryptedBlob, iv, originalName, mimeType, size } = await cryptoService.encryptFile(file, room.id);
      
      // Calculer le hash du fichier CHIFFRÉ (pas du fichier original)
      const checksum = await cryptoService.calculateFileHash(encryptedBlob);

      // Créer FormData
      const formData = new FormData();
      // Conserver l'extension originale pour la validation Multer
      const encryptedFileName = originalName || 'encrypted_file.bin';
      formData.append('file', encryptedBlob, encryptedFileName);
      formData.append('roomId', room.id.toString());
      formData.append('iv', iv);
      formData.append('checksum', checksum);
      
      console.log('Upload fichier:', {
        originalName,
        encryptedSize: encryptedBlob.size,
        originalSize: size,
        checksum: checksum.substring(0, 16) + '...'
      });

      // Upload le fichier
      const response = await filesAPI.upload(formData);

      // Envoyer un message avec le fichier
      const fileMessage = `📎 ${originalName} (${(size / 1024).toFixed(2)} KB)`;
      const { encrypted, iv: messageIv } = await cryptoService.encryptMessage(fileMessage, room.id);

      socketService.sendMessage(room.id, encrypted, messageIv, 'file', {
        id: response.data.file.id,
        filename: response.data.file.filename,
        originalName: originalName,
        mimeType: mimeType,
        size: size,
        iv: iv, // Inclure l'IV pour le déchiffrement
      });

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
        <div className="online-indicator">
          <span className="online-dot"></span>
          <span>{onlineUsers.length} {t('chat.online')}</span>
        </div>
      </div>

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
                {message.type === 'file' ? (
                  <div>
                    <p>{message.content}</p>
                    {message.file && (
                      <div className="file-message">
                        <a
                          href={`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/files/${message.file.id || message.file.filename}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="file-link"
                          onClick={async (e) => {
                            e.preventDefault();
                            if (!message.file.id && !message.file.filename) {
                              alert(t('errors.fileDownloadError'));
                              return;
                            }
                            
                            try {
                              // Télécharger le fichier (utiliser l'ID si disponible, sinon le filename)
                              const fileId = message.file.id || message.file.filename;
                              const response = await filesAPI.download(fileId);
                              
                              // Le fichier est chiffré, il faut le déchiffrer
                              const blob = new Blob([response.data]);
                              
                              // Récupérer l'IV depuis les headers de la réponse ou le message
                              const fileIv = response.headers['x-file-iv'] || message.file.iv || '';
                              
                              if (!fileIv) {
                                throw new Error(t('errors.decryptionError'));
                              }
                              
                              const decryptedBlob = await cryptoService.decryptFile(
                                blob,
                                fileIv,
                                room.id
                              );
                              
                              // Créer un lien de téléchargement
                              const url = window.URL.createObjectURL(decryptedBlob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = message.file.originalName || 'file';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              window.URL.revokeObjectURL(url);
                            } catch (error) {
                              console.error('Erreur lors du téléchargement du fichier:', error);
                              alert('Erreur lors du téléchargement du fichier: ' + (error.response?.data?.error || error.message));
                            }
                          }}
                        >
                          📎 {t('chat.download')} {message.file.originalName || t('chat.file')}
                        </a>
                        {message.file.size && (
                          <span className="file-size">
                            ({(message.file.size / 1024).toFixed(2)} KB)
                          </span>
                        )}
                      </div>
                    )}
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
        <button type="submit" className="send-btn" disabled={sending || !newMessage.trim()}>
          {sending ? t('chat.sending') : t('chat.send')}
        </button>
      </form>
    </div>
  );
};

export default ChatRoom;

