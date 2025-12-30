import React, { useState } from 'react';
import { roomsAPI } from '../../services/api';
import CreateRoomModal from './CreateRoomModal';
import { useTranslation } from '../../i18n';
import './Sidebar.css';

const Sidebar = ({ user, rooms, selectedRoom, onRoomSelect, onRoomCreated, onRoomDeleted, onLogout }) => {
  const { t } = useTranslation();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreateRoom = async (roomData) => {
    try {
      const response = await roomsAPI.create(roomData);
      onRoomCreated(response.data.room);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Erreur lors de la création de la room:', error);
      alert(error.response?.data?.error || t('errors.network'));
    }
  };

  const handleDeleteRoom = async (roomId, e) => {
    e.stopPropagation();
    
    if (!window.confirm(t('chat.deleteRoom') + '?')) {
      return;
    }

    try {
      await roomsAPI.delete(roomId);
      onRoomDeleted(roomId);
    } catch (error) {
      console.error('Erreur lors de la suppression de la room:', error);
      alert(error.response?.data?.error || t('errors.network'));
    }
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>{t('app.name')}</h2>
        <div className="user-info">
          <div className="user-avatar">{getInitials(user.username)}</div>
          <div>
            <div className="username">{user.username}</div>
            <button className="logout-btn" onClick={onLogout}>
              {t('auth.logout')}
            </button>
          </div>
        </div>
      </div>

      <button className="create-room-btn" onClick={() => setShowCreateModal(true)}>
        + {t('chat.createRoom')}
      </button>

      <div className="rooms-list">
        {rooms.length === 0 ? (
          <div className="no-rooms">
            <p>{t('chat.createFirstRoom')}</p>
          </div>
        ) : (
          rooms.map(room => (
            <div
              key={room.id}
              className={`room-item ${selectedRoom?.id === room.id ? 'active' : ''}`}
              onClick={() => onRoomSelect(room)}
            >
              <div className="room-header">
                <h3>{room.name}</h3>
                {room.creator?.id === user.id && (
                  <button
                    className="delete-room-btn"
                    onClick={(e) => handleDeleteRoom(room.id, e)}
                    title={t('chat.deleteRoom')}
                  >
                    ×
                  </button>
                )}
              </div>
              {room.description && <p>{room.description}</p>}
              <div className="room-meta">
                <span>{room.members?.length || 0} {t('chat.members')}</span>
                {room.isPrivate && <span className="private-badge">🔒</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateRoom}
        />
      )}
    </div>
  );
};

export default Sidebar;

