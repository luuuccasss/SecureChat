/**
 * Database Configuration Module
 * 
 * Configures and exports Sequelize instance for MySQL database connection.
 * Handles connection pooling, authentication, and optional schema synchronization.
 * 
 * @module config/database
 * @requires sequelize - SQL ORM for Node.js
 */

const { Sequelize } = require('sequelize');

/**
 * Sequelize Instance Configuration
 * 
 * Creates a new Sequelize instance with MySQL dialect and connection settings.
 * Connection parameters are read from environment variables with sensible defaults.
 * 
 * @type {Sequelize}
 */
const sequelize = new Sequelize(
  process.env.DB_NAME || 'securechat',           // Database name
  process.env.DB_USER || 'root',                 // Database user
  process.env.DB_PASSWORD || '',                 // Database password
  {
    host: process.env.DB_HOST || 'localhost',    // Database host
    port: process.env.DB_PORT || 3306,          // Database port
    dialect: 'mysql',                            // Database dialect
    
    // Logging configuration
    // In development: log all SQL queries
    // In production: disable logging for performance
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    
    // Connection pool configuration
    // Manages multiple database connections efficiently
    pool: {
      max: 5,        // Maximum number of connections in pool
      min: 0,        // Minimum number of connections in pool
      acquire: 30000, // Maximum time (ms) to wait for connection
      idle: 10000    // Maximum time (ms) a connection can be idle
    },
    
    // Model definition defaults
    define: {
      timestamps: true,      // Automatically add createdAt/updatedAt columns
      underscored: false,    // Use camelCase for column names
      freezeTableName: true  // Prevent Sequelize from pluralizing table names
    }
  }
);

/**
 * Database Connection Function
 * 
 * Establishes connection to MySQL database and optionally synchronizes schema.
 * 
 * @async
 * @function connectDB
 * @returns {Promise<void>} Resolves when connection is established
 * @throws {Error} If connection fails
 * 
 * @example
 * await connectDB();
 */
const connectDB = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ MySQL connection established successfully');
    
    /**
     * Schema Synchronization (Development Only)
     * 
     * WARNING: Only enable in development environment!
     * This will alter your database schema to match your Sequelize models.
     * Set SYNC_DB=true in .env to enable.
     * 
     * In production, use migrations instead of sync().
     */
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
