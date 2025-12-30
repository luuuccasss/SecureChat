-- Migration: Ajouter la colonne fileId à la table messages
-- Exécuter cette requête dans MySQL pour mettre à jour la base de données existante

-- Ajouter la colonne fileId
ALTER TABLE messages 
ADD COLUMN fileId INT DEFAULT NULL AFTER type;

-- Ajouter l'index
ALTER TABLE messages 
ADD INDEX idx_fileId (fileId);

-- Ajouter la clé étrangère (optionnel, peut échouer si la table files n'existe pas encore)
-- ALTER TABLE messages 
-- ADD CONSTRAINT fk_messages_fileId 
-- FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE SET NULL;

