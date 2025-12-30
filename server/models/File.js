const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const File = sequelize.define('File', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  originalName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  mimeType: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  path: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  uploaderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  roomId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'rooms',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  encrypted: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  iv: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  checksum: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    // Pas de defaultValue - le hook beforeCreate s'en charge
  }
}, {
  tableName: 'files',
  indexes: [
    { fields: ['roomId', 'createdAt'] },
    { fields: ['uploaderId'] },
    { fields: ['expiresAt'] }
  ],
  hooks: {
    beforeCreate: (file) => {
      // Définir l'expiration à 30 jours si non défini ou si déjà expiré
      if (!file.expiresAt || new Date(file.expiresAt) < new Date()) {
        file.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
    },
    beforeUpdate: (file) => {
      // S'assurer que l'expiration n'est pas dans le passé lors d'une mise à jour
      if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
        file.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
    }
  }
});

module.exports = File;
