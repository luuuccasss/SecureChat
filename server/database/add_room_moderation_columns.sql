-- Migration: Ajouter les colonnes de modération à la table rooms
-- Date: 2025-12-30
-- Exécuter cette requête dans MySQL

-- Note: Si une colonne existe déjà, vous obtiendrez une erreur "Duplicate column name"
-- C'est normal, vous pouvez ignorer cette erreur et continuer avec les autres colonnes

-- Ajouter les nouvelles colonnes à la table rooms
ALTER TABLE rooms 
ADD COLUMN moderationEnabled BOOLEAN DEFAULT FALSE AFTER allowInvites;

ALTER TABLE rooms 
ADD COLUMN requireApproval BOOLEAN DEFAULT FALSE AFTER moderationEnabled;

ALTER TABLE rooms 
ADD COLUMN slowMode INT DEFAULT 0 AFTER requireApproval;

ALTER TABLE rooms 
ADD COLUMN readOnly BOOLEAN DEFAULT FALSE AFTER slowMode;

ALTER TABLE rooms 
ADD COLUMN archiveAfterDays INT DEFAULT NULL AFTER readOnly;

-- Vérifier que les colonnes ont été ajoutées
DESCRIBE rooms;

