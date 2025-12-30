const fs = require('fs');
const path = require('path');

// Créer le dossier logs s'il n'existe pas
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'app.log');

const logger = {
  info: (message, ...args) => {
    const log = `[INFO] ${new Date().toISOString()} - ${message} ${args.length ? JSON.stringify(args) : ''}\n`;
    console.log(`[INFO] ${message}`, ...args);
    fs.appendFileSync(logFile, log);
  },
  
  error: (message, ...args) => {
    const log = `[ERROR] ${new Date().toISOString()} - ${message} ${args.length ? JSON.stringify(args) : ''}\n`;
    console.error(`[ERROR] ${message}`, ...args);
    fs.appendFileSync(logFile, log);
  },
  
  warn: (message, ...args) => {
    const log = `[WARN] ${new Date().toISOString()} - ${message} ${args.length ? JSON.stringify(args) : ''}\n`;
    console.warn(`[WARN] ${message}`, ...args);
    fs.appendFileSync(logFile, log);
  },
  
  debug: (message, ...args) => {
    if (process.env.NODE_ENV === 'development') {
      const log = `[DEBUG] ${new Date().toISOString()} - ${message} ${args.length ? JSON.stringify(args) : ''}\n`;
      console.debug(`[DEBUG] ${message}`, ...args);
      fs.appendFileSync(logFile, log);
    }
  }
};

module.exports = logger;

