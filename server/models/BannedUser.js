const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BannedUser = sequelize.define('BannedUser', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
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
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  bannedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  reason: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true // null = bannissement permanent
  }
}, {
  tableName: 'banned_users',
  indexes: [
    { fields: ['roomId', 'userId'] },
    { fields: ['expiresAt'] },
    { fields: ['roomId', 'userId'], unique: true }
  ]
});

module.exports = BannedUser;

