/**
 * ================================================
 * LOGGER SERVICE - ITIL Service Management
 * ================================================
 * Gestion centralisée des logs selon ITIL v4
 * 
 * Niveaux de log:
 * - error: Incidents majeurs (ITIL Incident Management)
 * - warn: Alertes et problèmes potentiels
 * - info: Événements normaux (ITIL Event Management)
 * - debug: Informations détaillées pour debug
 * 
 * @author Matou - Neo-Logix QA Lead
 */

const winston = require('winston');
const path = require('path');

// Format personnalisé
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(info => {
    let message = `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`;
    
    // Ajouter les métadonnées si présentes
    if (Object.keys(info).length > 5) {
      const metadata = { ...info };
      delete metadata.timestamp;
      delete metadata.level;
      delete metadata.message;
      delete metadata[Symbol.for('level')];
      delete metadata[Symbol.for('splat')];
      
      if (Object.keys(metadata).length > 0) {
        message += `\n${JSON.stringify(metadata, null, 2)}`;
      }
    }
    
    return message;
  })
);

// Configuration Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Console pour développement
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    }),
    
    // Fichier pour tous les logs
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Fichier séparé pour les erreurs (ITIL Incident Management)
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/errors.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Créer le dossier logs s'il n'existe pas
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = logger;
