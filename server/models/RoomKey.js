const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A room key version, wrapped (RSA-OAEP) for one member. The server only stores
// these opaque blobs and never sees a room key in clear.
const RoomKey = sequelize.define('RoomKey', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  roomId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  wrappedKey: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  // Member who wrapped this key (the creator, a member sharing it, or a rotation)
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'room_keys',
  indexes: [
    { fields: ['roomId', 'userId', 'version'], unique: true },
    { fields: ['roomId', 'version'] }
  ]
});

module.exports = RoomKey;
