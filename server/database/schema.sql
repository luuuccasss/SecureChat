-- SQL script to create the SecureChat database
-- MySQL 5.7+ or MariaDB 10.2+

CREATE DATABASE IF NOT EXISTS securechat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE securechat;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(30) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  publicKey TEXT NOT NULL,
  encryptedPrivateKey TEXT DEFAULT NULL,
  avatar VARCHAR(500) DEFAULT NULL,
  isOnline BOOLEAN DEFAULT FALSE,
  lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
  tokenVersion INT NOT NULL DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_isOnline (isOnline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des rooms
CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT '',
  creatorId INT NOT NULL,
  isPrivate BOOLEAN DEFAULT FALSE,
  password VARCHAR(255) DEFAULT NULL,
  maxMembers INT DEFAULT 100,
  allowFileUpload BOOLEAN DEFAULT TRUE,
  allowInvites BOOLEAN DEFAULT TRUE,
  moderationEnabled BOOLEAN DEFAULT FALSE,
  requireApproval BOOLEAN DEFAULT FALSE,
  slowMode INT DEFAULT 0,
  readOnly BOOLEAN DEFAULT FALSE,
  archiveAfterDays INT DEFAULT NULL,
  keyVersion INT NOT NULL DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creatorId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_creatorId (creatorId),
  INDEX idx_isPrivate (isPrivate),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des membres de rooms (relation many-to-many)
CREATE TABLE IF NOT EXISTS room_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roomId INT NOT NULL,
  userId INT NOT NULL,
  role ENUM('owner', 'admin', 'member') DEFAULT 'member',
  joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_room_user (roomId, userId),
  INDEX idx_roomId (roomId),
  INDEX idx_userId (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des fichiers
CREATE TABLE IF NOT EXISTS files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  originalName VARCHAR(255) NOT NULL,
  mimeType VARCHAR(100) NOT NULL,
  size INT NOT NULL,
  path VARCHAR(500) NOT NULL,
  uploaderId INT NOT NULL,
  roomId INT NOT NULL,
  encrypted BOOLEAN DEFAULT TRUE,
  iv VARCHAR(255) NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  expiresAt DATETIME NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaderId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
  INDEX idx_roomId_createdAt (roomId, createdAt),
  INDEX idx_uploaderId (uploaderId),
  INDEX idx_expiresAt (expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des messages
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roomId INT NOT NULL,
  senderId INT NOT NULL,
  content TEXT NOT NULL,
  type ENUM('text', 'file', 'image', 'system') DEFAULT 'text',
  fileId INT DEFAULT NULL,
  fileFilename VARCHAR(255) DEFAULT NULL,
  fileOriginalName VARCHAR(255) DEFAULT NULL,
  fileMimeType VARCHAR(100) DEFAULT NULL,
  fileSize INT DEFAULT NULL,
  filePath VARCHAR(500) DEFAULT NULL,
  fileEncrypted BOOLEAN DEFAULT TRUE,
  encrypted BOOLEAN DEFAULT TRUE,
  iv VARCHAR(255) NOT NULL,
  keyVersion INT NOT NULL DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE SET NULL,
  INDEX idx_roomId_createdAt (roomId, createdAt),
  INDEX idx_senderId_createdAt (senderId, createdAt),
  INDEX idx_createdAt (createdAt),
  INDEX idx_fileId (fileId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des destinataires de messages (relation many-to-many)
CREATE TABLE IF NOT EXISTS message_recipients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  messageId INT NOT NULL,
  userId INT NOT NULL,
  delivered BOOLEAN DEFAULT FALSE,
  `read` BOOLEAN DEFAULT FALSE,
  deliveredAt DATETIME DEFAULT NULL,
  readAt DATETIME DEFAULT NULL,
  FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_message_user (messageId, userId),
  INDEX idx_messageId (messageId),
  INDEX idx_userId (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Room bans (expiresAt NULL = permanent)
CREATE TABLE IF NOT EXISTS banned_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roomId INT NOT NULL,
  userId INT NOT NULL,
  bannedBy INT NOT NULL,
  reason VARCHAR(500) DEFAULT NULL,
  expiresAt DATETIME DEFAULT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bannedBy) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_room_ban (roomId, userId),
  INDEX idx_expiresAt (expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Moderation and security audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT DEFAULT NULL,
  roomId INT DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  entityType ENUM('user', 'room', 'message', 'file', 'system') NOT NULL,
  entityId INT DEFAULT NULL,
  details TEXT DEFAULT NULL,
  ipAddress VARCHAR(45) DEFAULT NULL,
  userAgent VARCHAR(500) DEFAULT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
  INDEX idx_userId_createdAt (userId, createdAt),
  INDEX idx_roomId_createdAt (roomId, createdAt),
  INDEX idx_action_createdAt (action, createdAt),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Room keys wrapped for each member (end-to-end encryption, protocol v2)
CREATE TABLE IF NOT EXISTS room_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roomId INT NOT NULL,
  userId INT NOT NULL,
  version INT NOT NULL,
  wrappedKey TEXT NOT NULL,
  createdBy INT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_room_user_version (roomId, userId, version),
  INDEX idx_roomId_version (roomId, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
