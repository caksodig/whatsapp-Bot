const { LocalAuth } = require("whatsapp-web.js");
const path = require("path");
const logger = require("../utils/logger");

class WhatsAppConfig {
  constructor() {
    this.sessionName =
      process.env.WHATSAPP_SESSION_NAME || "trading-bot-session";
    this.sessionsPath = path.join(__dirname, "../../sessions");
    this.webhookUrl = process.env.WEBHOOK_URL || null;
    this.qrCodeRetries = parseInt(process.env.QR_CODE_RETRIES) || 3;
    this.authTimeout = parseInt(process.env.AUTH_TIMEOUT) || 60000;
    this.restartDelay = parseInt(process.env.RESTART_DELAY) || 5000;
  }

  getClientConfig() {
    return {
      authStrategy: new LocalAuth({
        dataPath: this.sessionsPath,
        clientId: this.sessionName,
      }),
      puppeteer: {
        headless: process.env.NODE_ENV === "production",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
        ],
        executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
      },
      webVersionCache: {
        type: "remote",
        remotePath:
          "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
      },
    };
  }

  getMessageHandlerConfig() {
    return {
      maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH) || 4000,
      typingDelay: parseInt(process.env.TYPING_DELAY) || 1000,
      messageDelay: parseInt(process.env.MESSAGE_DELAY) || 500,
      maxRetries: parseInt(process.env.MAX_MESSAGE_RETRIES) || 3,
      retryDelay: parseInt(process.env.RETRY_DELAY) || 2000,
    };
  }

  getMediaConfig() {
    return {
      maxFileSize: parseInt(process.env.MAX_IMAGE_SIZE) || 5242880, // 5MB
      supportedFormats: (
        process.env.SUPPORTED_FORMATS || "jpg,jpeg,png,webp"
      ).split(","),
      compressionQuality: parseInt(process.env.IMAGE_COMPRESSION_QUALITY) || 85,
      maxWidth: parseInt(process.env.MAX_IMAGE_WIDTH) || 1920,
      maxHeight: parseInt(process.env.MAX_IMAGE_HEIGHT) || 1080,
      downloadTimeout: parseInt(process.env.MEDIA_DOWNLOAD_TIMEOUT) || 30000,
    };
  }

  getSecurityConfig() {
    return {
      adminNumbers: this.parsePhoneNumbers(process.env.ADMIN_NUMBERS),
      allowedGroups: this.parseGroupIds(process.env.ALLOWED_GROUPS),
      rateLimitPerUser: parseInt(process.env.RATE_LIMIT_PER_USER) || 10,
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 3600000, // 1 hour
      blockUnauthorized: process.env.BLOCK_UNAUTHORIZED === "true",
      logUnauthorizedAttempts: process.env.LOG_UNAUTHORIZED === "true",
    };
  }

  getBotConfig() {
    return {
      name: process.env.BOT_NAME || "TradingBot SMC",
      version: process.env.BOT_VERSION || "1.0.0",
      description: "Smart Money Concept Trading Analysis Bot",
      commands: {
        help: "/help",
        status: "/status",
        info: "/info",
        stats: "/stats",
        reset: "/reset",
      },
      features: {
        autoAnalysis: true,
        saveHistory: true,
        sendTyping: true,
        rateLimiting: true,
        multiGroup: true,
      },
    };
  }

  getAnalysisConfig() {
    return {
      timeout: parseInt(process.env.ANALYSIS_TIMEOUT) || 30000,
      maxConcurrent: parseInt(process.env.MAX_CONCURRENT_ANALYSIS) || 3,
      retryAttempts: parseInt(process.env.ANALYSIS_RETRY_ATTEMPTS) || 2,
      retryDelay: parseInt(process.env.ANALYSIS_RETRY_DELAY) || 5000,
      cacheResults: process.env.CACHE_ANALYSIS === "true",
      cacheTTL: parseInt(process.env.CACHE_TTL) || 3600000, // 1 hour
    };
  }

  parsePhoneNumbers(phoneStr) {
    if (!phoneStr) return [];

    return phoneStr
      .split(",")
      .map((num) => num.trim())
      .filter((num) => num.length > 0)
      .map((num) => {
        // Ensure number starts with country code
        if (!num.startsWith("+") && !num.startsWith("62")) {
          return "62" + num;
        }
        return num.replace("+", "");
      });
  }

  parseGroupIds(groupStr) {
    if (!groupStr) return [];

    return groupStr
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  validateConfig() {
    const requiredEnvVars = [];
    const warnings = [];

    // Check AI API keys
    if (!process.env.OPENAI_API_KEY) {
      requiredEnvVars.push("OPENAI_API_KEY or GEMINI_API_KEY");
    }

    // Check optional but recommended settings
    if (!process.env.ADMIN_NUMBERS) {
      warnings.push(
        "ADMIN_NUMBERS not set - bot will accept messages from all users"
      );
    }

    if (!process.env.ALLOWED_GROUPS) {
      warnings.push("ALLOWED_GROUPS not set - bot will work in all groups");
    }

    if (requiredEnvVars.length > 0) {
      const error = `Missing required environment variables: ${requiredEnvVars.join(
        ", "
      )}`;
      logger.error(error);
      throw new Error(error);
    }

    if (warnings.length > 0) {
      warnings.forEach((warning) => logger.warn(warning));
    }

    logger.info("WhatsApp configuration validated successfully");
    return true;
  }

  getFullConfig() {
    return {
      client: this.getClientConfig(),
      messageHandler: this.getMessageHandlerConfig(),
      media: this.getMediaConfig(),
      security: this.getSecurityConfig(),
      bot: this.getBotConfig(),
      analysis: this.getAnalysisConfig(),
    };
  }
}

module.exports = new WhatsAppConfig();
