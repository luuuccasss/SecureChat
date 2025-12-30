const { Sequelize } = require('sequelize');

// Configuration de la connexion MySQL
const sequelize = new Sequelize(
  process.env.DB_NAME || 'securechat',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: true
    }
  }
);

// Test de connexion
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connecté avec succès');
    
    // Synchroniser les modèles (en développement uniquement)
    if (process.env.NODE_ENV === 'development' && process.env.SYNC_DB === 'true') {
      await sequelize.sync({ alter: true });
      console.log('✅ Modèles synchronisés');
    }
  } catch (error) {
    console.error('❌ Erreur de connexion MySQL:', error);
    throw error;
  }
};

module.exports = { sequelize, connectDB };
