-- Revocable sessions: every token carries the user's tokenVersion,
-- which is bumped on logout
USE securechat;
ALTER TABLE users ADD COLUMN tokenVersion INT NOT NULL DEFAULT 0 AFTER lastSeen;
