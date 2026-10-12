// Removes expired uploads and leftover files, so the 30-day retention promise holds
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const File = require('../models/File');

const uploadsDir = path.join(__dirname, '../uploads');
const ORPHAN_GRACE_MS = 60 * 60 * 1000; // uploads in progress have no DB row yet
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

const removeFromDisk = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

async function cleanupExpiredFiles() {
  const expiredFiles = await File.findAll({
    where: { expiresAt: { [Op.lt]: new Date() } }
  });

  let deletedCount = 0;
  for (const file of expiredFiles) {
    try {
      removeFromDisk(file.path);
      await file.destroy();
      deletedCount++;
    } catch (error) {
      console.error(`Erreur lors de la suppression du fichier ${file.id}:`, error);
    }
  }
  return deletedCount;
}

// Files on disk with no database row (failed uploads), older than the grace period
async function cleanupOrphanedFiles() {
  if (!fs.existsSync(uploadsDir)) return 0;

  const known = new Set((await File.findAll({ attributes: ['filename'] })).map(f => f.filename));
  let deletedCount = 0;
  for (const name of fs.readdirSync(uploadsDir)) {
    const filePath = path.join(uploadsDir, name);
    try {
      if (known.has(name) || Date.now() - fs.statSync(filePath).mtimeMs < ORPHAN_GRACE_MS) continue;
      fs.unlinkSync(filePath);
      deletedCount++;
    } catch (error) {
      console.error(`Erreur lors de la suppression du fichier orphelin ${name}:`, error);
    }
  }
  return deletedCount;
}

async function runCleanup() {
  try {
    const expired = await cleanupExpiredFiles();
    const orphaned = await cleanupOrphanedFiles();
    if (expired || orphaned) {
      console.log(`🧹 ${expired} fichier(s) expiré(s) et ${orphaned} orphelin(s) supprimé(s)`);
    }
  } catch (error) {
    console.error('Erreur lors du nettoyage des fichiers:', error);
  }
}

// Runs once at startup, then every 6 hours
function scheduleCleanup() {
  runCleanup();
  setInterval(runCleanup, CLEANUP_INTERVAL_MS).unref();
}

module.exports = { cleanupExpiredFiles, cleanupOrphanedFiles, runCleanup, scheduleCleanup };
