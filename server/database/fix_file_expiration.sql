-- Script pour corriger les dates d'expiration des fichiers existants
-- Met à jour tous les fichiers expirés ou sans expiration valide

-- Mettre à jour les fichiers avec une expiration dans le passé ou NULL
UPDATE files 
SET expiresAt = DATE_ADD(NOW(), INTERVAL 30 DAY)
WHERE expiresAt IS NULL 
   OR expiresAt < NOW()
   OR expiresAt = createdAt;

-- Vérifier les fichiers mis à jour
SELECT id, filename, originalName, expiresAt, createdAt 
FROM files 
ORDER BY createdAt DESC 
LIMIT 10;

