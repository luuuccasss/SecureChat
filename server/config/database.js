// Database configuration
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'securechat',           // Database name
  process.env.DB_USER || 'root',                 // Database user
  process.env.DB_PASSWORD || '',                 // Database password
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

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connection established successfully');
    
    // Schema sync (development only)
    if (process.env.NODE_ENV === 'development' && process.env.SYNC_DB === 'true') {
      await sequelize.sync({ alter: true });
      console.log('✅ Database models synchronized');
      console.warn('⚠️  WARNING: Schema sync enabled. Disable in production!');
    }
  } catch (error) {
    console.error('❌ MySQL connection error:', error);
    console.error('💡 Check your database credentials in server/.env');
    throw error;
  }
};

module.exports = { sequelize, connectDB };
