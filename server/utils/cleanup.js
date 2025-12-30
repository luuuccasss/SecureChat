const File = require('../models/File');
const fs = require('fs');
const path = require('path');

/**
 * Nettoie les fichiers expirés
 * À exécuter périodiquement (cron job recommandé)
 */
async function cleanupExpiredFiles() {
  try {
    const expiredFiles = await File.find({
      expiresAt: { $lt: new Date() }
    });

    let deletedCount = 0;

    for (const file of expiredFiles) {
      try {
        // Supprimer le fichier du système de fichiers
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }

        // Supprimer l'entrée de la base de données
        await File.findByIdAndDelete(file._id);
        deletedCount++;
      } catch (error) {
        console.error(`Erreur lors de la suppression du fichier ${file._id}:`, error);
      }
    }

    console.log(`✅ ${deletedCount} fichier(s) expiré(s) supprimé(s)`);
    return deletedCount;
  } catch (error) {
    console.error('Erreur lors du nettoyage des fichiers:', error);
    throw error;
  }
}

/**
 * Nettoie les fichiers orphelins (fichiers sans entrée en DB)
 */
async function cleanupOrphanedFiles() {
  try {
    const uploadsDir = path.join(__dirname, '../uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      return 0;
    }

    const files = fs.readdirSync(uploadsDir);
    const dbFiles = await File.find({}, 'filename');
    const dbFilenames = new Set(dbFiles.map(f => f.filename));

    let deletedCount = 0;

    for (const file of files) {
      if (!dbFilenames.has(file)) {
        try {
          const filePath = path.join(uploadsDir, file);
          fs.unlinkSync(filePath);
          deletedCount++;
        } catch (error) {
          console.error(`Erreur lors de la suppression du fichier orphelin ${file}:`, error);
        }
      }
    }

    console.log(`✅ ${deletedCount} fichier(s) orphelin(s) supprimé(s)`);
    return deletedCount;
  } catch (error) {
    console.error('Erreur lors du nettoyage des fichiers orphelins:', error);
    throw error;
  }
}

// Exécuter le nettoyage toutes les 24 heures
if (require.main === module) {
  setInterval(async () => {
    await cleanupExpiredFiles();
    await cleanupOrphanedFiles();
  }, 24 * 60 * 60 * 1000);

  // Exécuter immédiatement
  cleanupExpiredFiles();
  cleanupOrphanedFiles();
}

module.exports = {
  cleanupExpiredFiles,
  cleanupOrphanedFiles
};

