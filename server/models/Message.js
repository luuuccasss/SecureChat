const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Message = sequelize.define('Message', {
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
  senderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('text', 'file', 'image', 'system'),
    defaultValue: 'text'
  },
  fileId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'files',
      key: 'id'
    }
  },
  fileFilename: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  fileOriginalName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  fileMimeType: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  fileEncrypted: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  encrypted: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  iv: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  tableName: 'messages',
  indexes: [
    { fields: ['roomId', 'createdAt'] },
    { fields: ['senderId', 'createdAt'] },
    { fields: ['createdAt'] }
  ]
});

// Méthode pour obtenir les données de fichier formatées
Message.prototype.getFile = function() {
  if (!this.fileFilename && !this.fileId) return null;
  return {
    id: this.fileId,
    filename: this.fileFilename,
    originalName: this.fileOriginalName,
    mimeType: this.fileMimeType,
    size: this.fileSize,
    path: this.filePath,
    encrypted: this.fileEncrypted
  };
};

// Méthode pour marquer comme livré
Message.prototype.markAsDelivered = async function(userId) {
  const MessageRecipient = require('./MessageRecipient');
  await MessageRecipient.update(
    {
      delivered: true,
      deliveredAt: new Date()
    },
    {
      where: {
        messageId: this.id,
        userId: userId,
        delivered: false
      }
    }
  );
};

// Méthode pour marquer comme lu
Message.prototype.markAsRead = async function(userId) {
  const MessageRecipient = require('./MessageRecipient');
  const recipient = await MessageRecipient.findOne({
    where: {
      messageId: this.id,
      userId: userId
    }
  });

  if (recipient) {
    recipient.read = true;
    recipient.readAt = new Date();
    if (!recipient.delivered) {
      recipient.delivered = true;
      recipient.deliveredAt = new Date();
    }
    await recipient.save();
  }
};

module.exports = Message;
