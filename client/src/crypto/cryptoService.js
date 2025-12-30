/**
 * Service de chiffrement end-to-end utilisant Web Crypto API
 * 
 * Algorithme:
 * - RSA-2048 pour l'échange de clés
 * - AES-256-GCM pour le chiffrement symétrique des messages
 */

class CryptoService {
  constructor() {
    this.keyPair = null;
    this.publicKeyPem = null;
    this.privateKeyPem = null;
    this.sharedKeys = new Map(); // roomId -> CryptoKey (clé AES partagée)
  }

  /**
   * Génère une paire de clés RSA pour l'utilisateur
   */
  async generateKeyPair() {
    try {
      this.keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
      );

      // Exporter les clés en format PEM pour stockage/transmission
      this.publicKeyPem = await this.exportPublicKey(this.keyPair.publicKey);
      this.privateKeyPem = await this.exportPrivateKey(this.keyPair.privateKey);

      return {
        publicKey: this.publicKeyPem,
        privateKey: this.privateKeyPem
      };
    } catch (error) {
      console.error('Erreur lors de la génération de la paire de clés:', error);
      throw error;
    }
  }

  /**
   * Exporte la clé publique en format PEM
   */
  async exportPublicKey(key) {
    const exported = await window.crypto.subtle.exportKey('spki', key);
    const exportedAsBase64 = this.arrayBufferToBase64(exported);
    return `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64}\n-----END PUBLIC KEY-----`;
  }

  /**
   * Exporte la clé privée en format PEM
   */
  async exportPrivateKey(key) {
    const exported = await window.crypto.subtle.exportKey('pkcs8', key);
    const exportedAsBase64 = this.arrayBufferToBase64(exported);
    return `-----BEGIN PRIVATE KEY-----\n${exportedAsBase64}\n-----END PRIVATE KEY-----`;
  }

  /**
   * Importe une clé publique depuis le format PEM
   */
  async importPublicKey(pem) {
    try {
      const pemHeader = '-----BEGIN PUBLIC KEY-----';
      const pemFooter = '-----END PUBLIC KEY-----';
      const pemContents = pem
        .replace(pemHeader, '')
        .replace(pemFooter, '')
        .replace(/\s/g, '');
      
      const binaryDer = this.base64ToArrayBuffer(pemContents);
      
      return await window.crypto.subtle.importKey(
        'spki',
        binaryDer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false,
        ['encrypt']
      );
    } catch (error) {
      console.error('Erreur lors de l\'import de la clé publique:', error);
      throw error;
    }
  }

  /**
   * Importe une clé privée depuis le format PEM
   */
  async importPrivateKey(pem) {
    try {
      const pemHeader = '-----BEGIN PRIVATE KEY-----';
      const pemFooter = '-----END PRIVATE KEY-----';
      const pemContents = pem
        .replace(pemHeader, '')
        .replace(pemFooter, '')
        .replace(/\s/g, '');
      
      const binaryDer = this.base64ToArrayBuffer(pemContents);
      
      return await window.crypto.subtle.importKey(
        'pkcs8',
        binaryDer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        false,
        ['decrypt']
      );
    } catch (error) {
      console.error('Erreur lors de l\'import de la clé privée:', error);
      throw error;
    }
  }

  /**
   * Génère une clé AES-256 pour une room
   */
  async generateAESKey() {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Exporte une clé AES en base64
   */
  async exportAESKey(key) {
    const exported = await window.crypto.subtle.exportKey('raw', key);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Importe une clé AES depuis base64
   */
  async importAESKey(base64Key) {
    const keyData = this.base64ToArrayBuffer(base64Key);
    return await window.crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Génère une clé AES déterministe basée sur l'ID de la room
   * NOTE: Ceci est une solution temporaire pour le développement
   * En production, il faudrait un vrai système d'échange de clés
   */
  async generateDeterministicAESKey(roomId) {
    // S'assurer que roomId est une string pour la cohérence
    const roomIdStr = String(roomId);
    
    // Créer un hash déterministe de l'ID de la room
    const encoder = new TextEncoder();
    const data = encoder.encode(`room-${roomIdStr}-key`);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    
    // Utiliser les 32 premiers bytes comme clé AES
    const keyData = new Uint8Array(hashBuffer).slice(0, 32);
    
    return await window.crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Chiffre un message avec AES-256-GCM
   */
  async encryptMessage(message, roomId) {
    try {
      // Normaliser roomId pour la cohérence
      const roomIdNormalized = String(roomId);
      
      // Récupérer ou générer la clé AES pour cette room
      let key = this.sharedKeys.get(roomIdNormalized) || this.sharedKeys.get(roomId);
      
      if (!key) {
        // Utiliser une clé déterministe basée sur l'ID de la room
        // Cela permet à tous les utilisateurs d'avoir la même clé
        key = await this.generateDeterministicAESKey(roomIdNormalized);
        this.sharedKeys.set(roomIdNormalized, key);
        // Stocker aussi avec l'ID original au cas où
        if (roomIdNormalized !== String(roomId)) {
          this.sharedKeys.set(roomId, key);
        }
      }

      // Convertir le message en ArrayBuffer
      const encoder = new TextEncoder();
      const messageData = encoder.encode(message);

      // Générer un IV aléatoire (12 bytes pour GCM)
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // Chiffrer le message
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        messageData
      );

      // Convertir en base64 pour transmission
      const encryptedBase64 = this.arrayBufferToBase64(encryptedData);
      const ivBase64 = this.arrayBufferToBase64(iv);

      return {
        encrypted: encryptedBase64,
        iv: ivBase64
      };
    } catch (error) {
      console.error('Erreur lors du chiffrement:', error);
      throw error;
    }
  }

  /**
   * Déchiffre un message avec AES-256-GCM
   */
  async decryptMessage(encryptedData, iv, roomId) {
    try {
      // Normaliser roomId pour la cohérence
      const roomIdNormalized = String(roomId);
      
      let key = this.sharedKeys.get(roomIdNormalized) || this.sharedKeys.get(roomId);
      
      if (!key) {
        // Générer la clé déterministe si elle n'existe pas
        key = await this.generateDeterministicAESKey(roomIdNormalized);
        this.sharedKeys.set(roomIdNormalized, key);
        // Stocker aussi avec l'ID original au cas où
        if (roomIdNormalized !== String(roomId)) {
          this.sharedKeys.set(roomId, key);
        }
      }

      // Convertir depuis base64
      if (!encryptedData || !iv) {
        throw new Error('Données de déchiffrement incomplètes');
      }
      
      const encrypted = this.base64ToArrayBuffer(encryptedData);
      const ivArray = this.base64ToArrayBuffer(iv);

      // Déchiffrer
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivArray,
        },
        key,
        encrypted
      );

      // Convertir en texte
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error('Erreur lors du déchiffrement:', error);
      console.error('Détails:', {
        roomId,
        hasEncryptedData: !!encryptedData,
        hasIv: !!iv,
        encryptedDataLength: encryptedData?.length,
        ivLength: iv?.length
      });
      throw error;
    }
  }

  /**
   * Chiffre une clé AES avec la clé publique RSA d'un utilisateur
   */
  async encryptAESKeyWithRSA(aesKey, recipientPublicKeyPem) {
    try {
      const publicKey = await this.importPublicKey(recipientPublicKeyPem);
      const aesKeyBase64 = await this.exportAESKey(aesKey);
      
      const encoder = new TextEncoder();
      const keyData = encoder.encode(aesKeyBase64);

      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP',
        },
        publicKey,
        keyData
      );

      return this.arrayBufferToBase64(encrypted);
    } catch (error) {
      console.error('Erreur lors du chiffrement de la clé AES:', error);
      throw error;
    }
  }

  /**
   * Déchiffre une clé AES avec la clé privée RSA
   */
  async decryptAESKeyWithRSA(encryptedKeyBase64) {
    try {
      if (!this.keyPair) {
        throw new Error('Paire de clés non initialisée');
      }

      const encrypted = this.base64ToArrayBuffer(encryptedKeyBase64);

      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP',
        },
        this.keyPair.privateKey,
        encrypted
      );

      const decoder = new TextDecoder();
      const aesKeyBase64 = decoder.decode(decrypted);
      
      return await this.importAESKey(aesKeyBase64);
    } catch (error) {
      console.error('Erreur lors du déchiffrement de la clé AES:', error);
      throw error;
    }
  }

  /**
   * Chiffre un fichier
   */
  async encryptFile(file, roomId) {
    try {
      let key = this.sharedKeys.get(roomId);
      
      if (!key) {
        // Générer la clé déterministe si elle n'existe pas
        key = await this.generateDeterministicAESKey(roomId);
        this.sharedKeys.set(roomId, key);
      }

      // Lire le fichier
      const arrayBuffer = await file.arrayBuffer();

      // Générer un IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // Chiffrer
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        arrayBuffer
      );

      // Créer un Blob chiffré
      const encryptedBlob = new Blob([encryptedData], { type: file.type });

      return {
        encryptedBlob,
        iv: this.arrayBufferToBase64(iv),
        originalName: file.name,
        mimeType: file.type,
        size: file.size
      };
    } catch (error) {
      console.error('Erreur lors du chiffrement du fichier:', error);
      throw error;
    }
  }

  /**
   * Déchiffre un fichier
   */
  async decryptFile(encryptedBlob, iv, roomId) {
    try {
      let key = this.sharedKeys.get(roomId);
      
      if (!key) {
        // Générer la clé déterministe si elle n'existe pas
        key = await this.generateDeterministicAESKey(roomId);
        this.sharedKeys.set(roomId, key);
      }

      const arrayBuffer = await encryptedBlob.arrayBuffer();
      const ivArray = this.base64ToArrayBuffer(iv);

      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivArray,
        },
        key,
        arrayBuffer
      );

      return new Blob([decryptedData]);
    } catch (error) {
      console.error('Erreur lors du déchiffrement du fichier:', error);
      throw error;
    }
  }

  /**
   * Calcule le hash SHA-256 d'un fichier ou Blob
   */
  async calculateFileHash(fileOrBlob) {
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
    return this.arrayBufferToHex(hashBuffer);
  }

  // Utilitaires de conversion
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  arrayBufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Initialise le service avec une clé privée existante
   */
  async initializeWithPrivateKey(privateKeyPem) {
    try {
      await this.importPrivateKey(privateKeyPem);
      // Pour RSA, on ne peut pas recréer la paire complète, mais on peut stocker la clé privée
      this.privateKeyPem = privateKeyPem;
      // Note: En production, il faudrait aussi stocker la clé publique correspondante
    } catch (error) {
      console.error('Erreur lors de l\'initialisation avec la clé privée:', error);
      throw error;
    }
  }

  /**
   * Stocke la clé AES pour une room (après échange de clés)
   */
  setRoomKey(roomId, key) {
    this.sharedKeys.set(roomId, key);
  }

  /**
   * Vérifie si on a une clé pour une room
   */
  hasRoomKey(roomId) {
    return this.sharedKeys.has(roomId);
  }

  /**
   * Exporte une clé AES en base64
   */
  async exportAESKey(key) {
    const exported = await window.crypto.subtle.exportKey('raw', key);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Chiffre une clé AES avec la clé publique RSA d'un utilisateur
   */
  async encryptAESKey(keyBase64, recipientPublicKeyPem) {
    return await this.encryptAESKeyWithRSA(
      await this.importAESKey(keyBase64),
      recipientPublicKeyPem
    );
  }

  /**
   * Déchiffre une clé AES avec la clé privée RSA
   */
  async decryptAESKey(encryptedKeyBase64) {
    return await this.decryptAESKeyWithRSA(encryptedKeyBase64);
  }

  /**
   * Récupère la clé publique de l'utilisateur
   */
  getPublicKey() {
    return this.publicKeyPem;
  }
}

// Instance singleton
const cryptoService = new CryptoService();

export default cryptoService;

