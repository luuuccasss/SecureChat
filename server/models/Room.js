const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Room = sequelize.define('Room', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100]
    }
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: '',
    validate: {
      len: [0, 500]
    }
  },
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  isPrivate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null
  },
  maxMembers: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    validate: {
      min: 2,
      max: 1000
    }
  },
  allowFileUpload: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  allowInvites: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  moderationEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  requireApproval: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  slowMode: {
    type: DataTypes.INTEGER,
    defaultValue: 0, // 0 = désactivé, nombre de secondes entre messages
    validate: {
      min: 0,
      max: 3600
    }
  },
  readOnly: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  archiveAfterDays: {
    type: DataTypes.INTEGER,
    defaultValue: null, // null = jamais, nombre de jours avant archivage
    validate: {
      min: 1,
      max: 3650
    }
  }
}, {
  tableName: 'rooms',
  indexes: [
    { fields: ['creatorId'] },
    { fields: ['isPrivate'] },
    { fields: ['createdAt'] }
  ]
});

// Méthode pour vérifier si un utilisateur est membre
Room.prototype.isMember = async function(userId) {
  const RoomMember = require('./RoomMember');
  const member = await RoomMember.findOne({
    where: {
      roomId: this.id,
      userId: userId
    }
  });
  return !!member;
};

// Méthode pour obtenir le rôle d'un utilisateur
Room.prototype.getUserRole = async function(userId) {
  const RoomMember = require('./RoomMember');
  const member = await RoomMember.findOne({
    where: {
      roomId: this.id,
      userId: userId
    }
  });
  return member ? member.role : null;
};

// Méthode pour vérifier les permissions
Room.prototype.hasPermission = async function(userId, permission) {
  const role = await this.getUserRole(userId);
  if (!role) return false;
  
  if (role === 'owner') return true;
  if (role === 'admin' && permission !== 'delete_room') return true;
  if (role === 'member' && ['send_message', 'upload_file'].includes(permission)) return true;
  
  return false;
};

module.exports = Room;
