const winston = require("winston");
const path = require("path");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "whatsapp-trading-bot" },
  transports: [
    // File untuk error logs
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/error.log"),
      level: "error",
      maxsize: parseInt(process.env.MAX_LOG_SIZE || "10485760"), // 10MB
      maxFiles: parseInt(process.env.MAX_LOG_FILES || "5"),
    }),

    // File untuk semua logs
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/combined.log"),
      maxsize: parseInt(process.env.MAX_LOG_SIZE || "10485760"), // 10MB
      maxFiles: parseInt(process.env.MAX_LOG_FILES || "5"),
    }),
  ],
});

// Jika bukan production, log ke console juga
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

module.exports = logger;
