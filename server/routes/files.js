const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { File, Room } = require('../models');
const { authenticate } = require('../middleware/auth');
const { fileUploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtre des types de fichiers autorisés
const fileFilter = (req, file, cb) => {
  // Les fichiers sont chiffrés côté client, donc on accepte tous les fichiers
  // La validation du type original se fait côté client avant le chiffrement
  // On fait confiance au client pour envoyer uniquement des types autorisés
  cb(null, true);
  
  // Note: En production, on pourrait ajouter une validation supplémentaire
  // basée sur des métadonnées ou un header personnalisé
};

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB par défaut
  },
  fileFilter
});

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Upload un fichier
router.post('/upload', fileUploadLimiter, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const { roomId, iv, checksum } = req.body;

    if (!roomId) {
      // Supprimer le fichier uploadé
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'roomId est requis' });
    }

    // Vérifier que l'utilisateur est membre de la room
    const room = await Room.findByPk(roomId);
    if (!room) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Room non trouvée' });
    }

    const isMember = await room.isMember(req.user.id);
    if (!isMember) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette room' });
    }

    // Vérifier les permissions d'upload
    if (!room.allowFileUpload) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'L\'upload de fichiers n\'est pas autorisé dans cette room' });
    }

    // Calculer le checksum du fichier chiffré reçu
    const fileBuffer = fs.readFileSync(req.file.path);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Vérifier le checksum si fourni
    if (checksum && hash !== checksum) {
      console.error('Checksum invalide:', {
        received: checksum,
        calculated: hash,
        fileSize: req.file.size
      });
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        error: 'Checksum invalide',
        details: 'Le fichier a peut-être été corrompu lors du transfert'
      });
    }

    // Créer l'entrée en base de données
    // Le hook beforeCreate définira automatiquement expiresAt à 30 jours
    const file = await File.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploaderId: req.user.id,
      roomId: roomId,
      encrypted: true,
      iv: iv || '',
      checksum: hash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
    });

    res.status(201).json({
      message: 'Fichier uploadé avec succès',
      file: {
        id: file.id,
        filename: file.filename,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        encrypted: file.encrypted,
        iv: file.iv,
        createdAt: file.createdAt
      }
    });
  } catch (error) {
    // Supprimer le fichier en cas d'erreur
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Erreur lors de la suppression du fichier:', unlinkError);
      }
    }
    console.error('Erreur upload fichier:', error);
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
