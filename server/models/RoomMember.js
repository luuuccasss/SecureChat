const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RoomMember = sequelize.define('RoomMember', {
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
  role: {
    type: DataTypes.ENUM('owner', 'admin', 'member'),
    defaultValue: 'member'
  },
  joinedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'room_members',
  timestamps: false, // Pas de createdAt/updatedAt dans le schéma SQL
  indexes: [
    { fields: ['roomId'] },
    { fields: ['userId'] },
    { fields: ['roomId', 'userId'], unique: true }
  ]
});

module.exports = RoomMember;

