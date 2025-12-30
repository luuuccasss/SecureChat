-- Migration: Ajouter la colonne fileId à la table messages
-- Date: 2025-12-30

-- Ajouter la colonne fileId si elle n'existe pas
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS fileId INT DEFAULT NULL AFTER type,
ADD INDEX IF NOT EXISTS idx_fileId (fileId);

-- Ajouter la clé étrangère si elle n'existe pas
-- Note: MySQL ne supporte pas "IF NOT EXISTS" pour les FOREIGN KEY
-- Il faut vérifier manuellement si la clé existe avant de l'ajouter
-- ALTER TABLE messages 
-- ADD CONSTRAINT fk_messages_fileId 
-- FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE SET NULL;

