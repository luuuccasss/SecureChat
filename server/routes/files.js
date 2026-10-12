const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { File, Room } = require('../models');
const { authenticate } = require('../middleware/auth');
const { fileUploadLimiter } = require('../middleware/rateLimiter');

const { pipeline } = require('stream/promises');

const router = express.Router();

const IV_PATTERN = /^[A-Za-z0-9+/]{16}$/; // 12-byte AES-GCM IV in base64
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/;

// Keep a displayable file name: no path, no control characters, bounded length
const sanitizeName = (name) => {
  const base = path.basename(String(name || '')).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').trim();
  return (base || 'file').slice(0, 200);
};

const sha256File = async (filePath) => {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest('hex');
};

const removeUpload = (file) => {
  if (file && fs.existsSync(file.path)) {
    fs.unlink(file.path, () => {});
  }
};

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuration Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Random storage name: nothing from the client ends up in the path
    cb(null, crypto.randomBytes(16).toString('hex') + '.enc');
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB par défaut
    files: 1,
    fields: 5
  }
});

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Room checks run before multer, so nothing is written to disk for non-members
const checkUploadRoom = async (req, res, next) => {
  try {
    const room = await Room.findByPk(req.query.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room non trouvée' });
    }
    const role = await room.getUserRole(req.user.id);
    if (!role) {
      return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette room' });
    }
    const isModerator = role === 'owner' || role === 'admin';
    if (!room.allowFileUpload || (room.readOnly && !isModerator)) {
      return res.status(403).json({ error: 'L\'upload de fichiers n\'est pas autorisé dans cette room' });
    }
    req.room = room;
    next();
  } catch (error) {
    next(error);
  }
};

// Upload un fichier (déjà chiffré par le client) : POST /files/upload?roomId=…
router.post('/upload', fileUploadLimiter, checkUploadRoom, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const { iv, checksum } = req.body;
    if (typeof iv !== 'string' || !IV_PATTERN.test(iv)) {
      removeUpload(req.file);
      return res.status(400).json({ error: 'IV invalide' });
    }

    // Calculer le checksum du fichier chiffré reçu
    const hash = await sha256File(req.file.path);
    if (checksum && (!CHECKSUM_PATTERN.test(checksum) || hash !== checksum)) {
      removeUpload(req.file);
      return res.status(400).json({
        error: 'Checksum invalide',
        details: 'Le fichier a peut-être été corrompu lors du transfert'
      });
    }

    // The content is ciphertext: its real type is unknown to the server
    const file = await File.create({
      filename: req.file.filename,
      originalName: sanitizeName(req.file.originalname),
      mimeType: 'application/octet-stream',
      size: req.file.size,
      path: req.file.path,
      uploaderId: req.user.id,
      roomId: req.room.id,
      encrypted: true,
      iv,
      checksum: hash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
    });

    res.status(201).json({
      message: 'Fichier uploadé avec succès',
      file: {
        id: file.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        encrypted: file.encrypted,
        iv: file.iv,
        createdAt: file.createdAt
      }
    });
  } catch (error) {
    removeUpload(req.file);
    next(error);
  }
});

// Télécharger un fichier
router.get('/:fileId/download', async (req, res, next) => {
  try {
    const file = await File.findByPk(req.params.fileId, {
      include: [
        { model: Room, as: 'room' }
      ]
    });

    if (!file) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    // Vérifier que l'utilisateur est membre de la room
    const isMember = await file.room.isMember(req.user.id);
    if (!isMember) {
      return res.status(403).json({ error: 'Vous n\'avez pas accès à ce fichier' });
    }

    // Vérifier si le fichier existe
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({ error: 'Fichier introuvable sur le serveur' });
    }

    // Vérifier l'expiration (seulement si expiresAt est défini et dans le passé)
    if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
      console.warn(`Fichier ${file.id} expiré depuis ${file.expiresAt}`);
      return res.status(410).json({ 
        error: 'Fichier expiré',
        expiresAt: file.expiresAt
      });
    }

    // Envoyer le fichier avec l'IV dans les headers pour le déchiffrement côté client
    res.setHeader('X-File-IV', file.iv || '');
    res.setHeader('X-File-Encrypted', file.encrypted ? 'true' : 'false');
    
    res.download(file.path, file.originalName, (err) => {
      if (err) {
        console.error('Erreur lors du téléchargement:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Erreur lors du téléchargement' });
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Obtenir les fichiers d'une room
router.get('/room/:roomId', async (req, res, next) => {
  try {
    const room = await Room.findByPk(req.params.roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room non trouvée' });
    }

    const isMember = await room.isMember(req.user.id);
    if (!isMember) {
      return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette room' });
    }

    const files = await File.findAll({
      where: { roomId: req.params.roomId },
      attributes: ['id', 'originalName', 'mimeType', 'size', 'encrypted', 'iv', 'createdAt', 'expiresAt'],
      include: [
        { model: require('../models').User, as: 'uploader', attributes: ['id', 'username'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json({ files });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
