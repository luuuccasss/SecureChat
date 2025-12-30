import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import ChatRoom from './ChatRoom';
import socketService from '../../services/socketService';
import { roomsAPI } from '../../services/api';
import { useTranslation } from '../../i18n';
import './Chat.css';

const Chat = ({ user, onLogout }) => {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadRooms = useCallback(async () => {
    try {
      const response = await roomsAPI.getMyRooms();
      setRooms(response.data.rooms);
      if (response.data.rooms.length > 0 && !selectedRoom) {
        setSelectedRoom(response.data.rooms[0]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des rooms:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedRoom]);

  useEffect(() => {
    loadRooms();

    // Écouter les événements Socket.IO
    socketService.on('user_joined', handleUserJoined);
    socketService.on('user_left', handleUserLeft);

    return () => {
      socketService.off('user_joined', handleUserJoined);
      socketService.off('user_left', handleUserLeft);
    };
  }, [loadRooms]);

  const handleUserJoined = (data) => {
    console.log('Utilisateur rejoint:', data);
  };

  const handleUserLeft = (data) => {
    console.log('Utilisateur quitté:', data);
  };

  const handleRoomSelect = (room) => {
    if (selectedRoom && selectedRoom.id === room.id) return;
    
    // Quitter l'ancienne room
    if (selectedRoom) {
      socketService.leaveRoom(selectedRoom.id);
    }

    // Rejoindre la nouvelle room
    setSelectedRoom(room);
    socketService.joinRoom(room.id);
  };

  const handleRoomCreated = (newRoom) => {
    setRooms([...rooms, newRoom]);
    setSelectedRoom(newRoom);
    socketService.joinRoom(newRoom.id);
  };

  const handleRoomDeleted = (roomId) => {
    setRooms(rooms.filter(r => r.id !== roomId));
    if (selectedRoom && selectedRoom.id === roomId) {
      setSelectedRoom(null);
    }
  };

  if (loading) {
    return (
      <div className="chat-loading">
        <div className="spinner"></div>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <Sidebar
        user={user}
        rooms={rooms}
        selectedRoom={selectedRoom}
        onRoomSelect={handleRoomSelect}
        onRoomCreated={handleRoomCreated}
        onRoomDeleted={handleRoomDeleted}
        onLogout={onLogout}
      />
      {selectedRoom ? (
        <ChatRoom room={selectedRoom} user={user} />
      ) : (
        <div className="chat-empty">
          <h2>Sélectionnez une room pour commencer à chatter</h2>
        </div>
      )}
    </div>
  );
};

export default Chat;

