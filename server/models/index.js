const { sequelize } = require('../config/database');
const User = require('./User');
const Room = require('./Room');
const RoomMember = require('./RoomMember');
const Message = require('./Message');
const MessageRecipient = require('./MessageRecipient');
const File = require('./File');
const BannedUser = require('./BannedUser');
const AuditLog = require('./AuditLog');

// Définir les associations
User.hasMany(Room, { foreignKey: 'creatorId', as: 'createdRooms' });
Room.belongsTo(User, { foreignKey: 'creatorId', as: 'creator' });

// Relations RoomMember (many-to-many)
User.belongsToMany(Room, { 
  through: RoomMember, 
  foreignKey: 'userId', 
  otherKey: 'roomId',
  as: 'rooms' 
});
Room.belongsToMany(User, { 
  through: RoomMember, 
  foreignKey: 'roomId', 
  otherKey: 'userId',
  as: 'members' 
});

// Associations directes pour RoomMember (pour les includes)
RoomMember.belongsTo(Room, { foreignKey: 'roomId', as: 'Room' });
RoomMember.belongsTo(User, { foreignKey: 'userId', as: 'User' });
Room.hasMany(RoomMember, { foreignKey: 'roomId', as: 'roomMembers' });
User.hasMany(RoomMember, { foreignKey: 'userId', as: 'roomMemberships' });

// Relations Message
User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Room.hasMany(Message, { foreignKey: 'roomId', as: 'messages' });
Message.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

// Relations MessageRecipient (many-to-many)
User.belongsToMany(Message, { 
  through: MessageRecipient, 
  foreignKey: 'userId', 
  otherKey: 'messageId',
  as: 'receivedMessages' 
});
Message.belongsToMany(User, { 
  through: MessageRecipient, 
  foreignKey: 'messageId', 
  otherKey: 'userId',
  as: 'recipients' 
});

// Associations directes pour MessageRecipient (pour les includes)
MessageRecipient.belongsTo(Message, { foreignKey: 'messageId', as: 'Message' });
MessageRecipient.belongsTo(User, { foreignKey: 'userId', as: 'User' });
Message.hasMany(MessageRecipient, { foreignKey: 'messageId', as: 'messageRecipients' });
User.hasMany(MessageRecipient, { foreignKey: 'userId', as: 'messageRecipients' });

// Relations File
User.hasMany(File, { foreignKey: 'uploaderId', as: 'uploadedFiles' });
File.belongsTo(User, { foreignKey: 'uploaderId', as: 'uploader' });
Room.hasMany(File, { foreignKey: 'roomId', as: 'files' });
File.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

// Relations BannedUser
Room.hasMany(BannedUser, { foreignKey: 'roomId', as: 'bannedUsers' });
BannedUser.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });
User.hasMany(BannedUser, { foreignKey: 'userId', as: 'bans' });
BannedUser.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(BannedUser, { foreignKey: 'bannedBy', as: 'bansIssued' });
BannedUser.belongsTo(User, { foreignKey: 'bannedBy', as: 'bannedByUser' });

// Relations AuditLog
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Room.hasMany(AuditLog, { foreignKey: 'roomId', as: 'auditLogs' });
AuditLog.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

module.exports = {
  sequelize,
  User,
  Room,
  RoomMember,
  Message,
  MessageRecipient,
  File,
  BannedUser,
  AuditLog
};

