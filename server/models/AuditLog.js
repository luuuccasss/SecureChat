const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true, // null pour les actions système
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'SET NULL'
  },
  roomId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'rooms',
      key: 'id'
    },
    onDelete: 'SET NULL'
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  entityType: {
    type: DataTypes.ENUM('user', 'room', 'message', 'file', 'system'),
    allowNull: false
  },
  entityId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true // JSON string pour les détails
  },
  ipAddress: {
    type: DataTypes.STRING(45), // IPv6 support
    allowNull: true
  },
  userAgent: {
    type: DataTypes.STRING(500),
    allowNull: true
  }
}, {
  tableName: 'audit_logs',
  indexes: [
    { fields: ['userId', 'createdAt'] },
    { fields: ['roomId', 'createdAt'] },
    { fields: ['action', 'createdAt'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = AuditLog;

