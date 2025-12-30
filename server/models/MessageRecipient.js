const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MessageRecipient = sequelize.define('MessageRecipient', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  messageId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'messages',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  delivered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'message_recipients',
  timestamps: false, // Pas de createdAt/updatedAt dans le schéma SQL
  indexes: [
    { fields: ['messageId'] },
    { fields: ['userId'] },
    { fields: ['messageId', 'userId'], unique: true }
  ]
});

module.exports = MessageRecipient;

