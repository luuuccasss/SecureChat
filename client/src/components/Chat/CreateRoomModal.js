import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import './CreateRoomModal.css';

const CreateRoomModal = ({ onClose, onCreate }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPrivate: false,
    password: '',
    maxMembers: 100,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert(t('errors.validation'));
      return;
    }

    if (formData.isPrivate && !formData.password) {
      alert(t('errors.validation'));
      return;
    }

    onCreate(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('chat.createRoom')}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">{t('chat.roomName')} *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              maxLength={100}
            />
          </div>
          <div className="form-group">
            <label htmlFor="description">{t('chat.description')}</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              maxLength={500}
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                name="isPrivate"
                checked={formData.isPrivate}
                onChange={handleChange}
              />
              {t('chat.private')} ({t('chat.password')})
            </label>
          </div>
          {formData.isPrivate && (
            <div className="form-group">
              <label htmlFor="password">{t('chat.password')} *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required={formData.isPrivate}
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="maxMembers">{t('chat.maxMembers')}</label>
            <input
              type="number"
              id="maxMembers"
              name="maxMembers"
              value={formData.maxMembers}
              onChange={handleChange}
              min={2}
              max={1000}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-submit">
              {t('chat.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoomModal;

