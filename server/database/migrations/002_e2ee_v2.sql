-- End-to-end encryption protocol v2.
-- Messages and files encrypted by v1 clients used a key derived from the room id
-- and must be considered public: they are deleted, and accounts created before
-- v2 have to register again (their private key was never stored server-side).
USE securechat;

ALTER TABLE users ADD COLUMN encryptedPrivateKey TEXT DEFAULT NULL AFTER publicKey;
ALTER TABLE rooms ADD COLUMN keyVersion INT NOT NULL DEFAULT 1 AFTER archiveAfterDays;
ALTER TABLE messages ADD COLUMN keyVersion INT NOT NULL DEFAULT 1 AFTER iv;

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

DELETE FROM message_recipients;
DELETE FROM messages;
DELETE FROM files;
DELETE FROM users WHERE encryptedPrivateKey IS NULL;
