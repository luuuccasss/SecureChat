-- Migration: Ajouter les tables de modération et nouvelles options de rooms
-- Date: 2025-12-30

-- Ajouter les nouvelles colonnes à la table rooms
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS moderationEnabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS requireApproval BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS slowMode INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS readOnly BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archiveAfterDays INT DEFAULT NULL;

-- Table des utilisateurs bannis
CREATE TABLE IF NOT EXISTS banned_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roomId INT NOT NULL,
  userId INT NOT NULL,
  bannedBy INT NOT NULL,
  reason VARCHAR(500) DEFAULT NULL,
  expiresAt DATETIME DEFAULT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bannedBy) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_room_user (roomId, userId),
  INDEX idx_roomId (roomId),
  INDEX idx_userId (userId),
  INDEX idx_expiresAt (expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des logs d'audit
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
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE SET NULL,
  INDEX idx_userId_createdAt (userId, createdAt),
  INDEX idx_roomId_createdAt (roomId, createdAt),
  INDEX idx_action_createdAt (action, createdAt),
  INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

