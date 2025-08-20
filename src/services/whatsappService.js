const { Client, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const whatsappConfig = require("../config/whatsapp");
const logger = require("../utils/logger");

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.qrRetries = 0;
    this.rateLimiter = new Map();
    this.config = whatsappConfig.getFullConfig();
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async initialize() {
    try {
      // Validate configuration
      whatsappConfig.validateConfig();

      // Create WhatsApp client
      this.client = new Client(this.config.client);

      // Setup event handlers
      this.setupEventHandlers();

      // Initialize client
      await this.client.initialize();

      logger.info("WhatsApp service initialization started");
    } catch (error) {
      logger.error("WhatsApp service initialization failed:", error);
      throw error;
    }
  }

  setupEventHandlers() {
    // QR Code event
    this.client.on("qr", (qr) => {
      console.log("\n🔗 Scan QR Code dengan WhatsApp Anda:");
      qrcode.generate(qr, { small: true });

      this.qrRetries++;
      if (this.qrRetries > this.config.client.qrCodeRetries) {
        logger.error("Max QR code retries reached");
        this.restart();
      }
    });

    // Ready event
    this.client.on("ready", async () => {
      this.isReady = true;
      this.qrRetries = 0;
      this.reconnectAttempts = 0;

      logger.info("✅ WhatsApp client ready");
      console.log("✅ Bot WhatsApp Trading siap digunakan!");

      // Get client info
      const clientInfo = this.client.info;
      logger.info(`Client: ${clientInfo.pushname} (${clientInfo.wid.user})`);

      // Start processing queued messages
      this.processMessageQueue();
    });

    // Authenticated event
    this.client.on("authenticated", () => {
      logger.info("WhatsApp client authenticated");
    });

    // Authentication failure event
    this.client.on("auth_failure", (msg) => {
      logger.error("Authentication failure:", msg);
      this.restart();
    });

    // Disconnected event
    this.client.on("disconnected", (reason) => {
      this.isReady = false;
      logger.warn("WhatsApp client disconnected:", reason);

      // Attempt to reconnect
      this.handleDisconnection(reason);
    });

    // Loading screen event
    this.client.on("loading_screen", (percent, message) => {
      if (percent < 100) {
        logger.info(`Loading: ${percent}% - ${message}`);
      }
    });

    // Error events
    this.client.on("error", (error) => {
      logger.error("WhatsApp client error:", error);
    });
  }

  async sendMessage(chatId, message, options = {}) {
    try {
      if (!this.isReady) {
        // Queue message if client not ready
        this.messageQueue.push({
          chatId,
          message,
          options,
          timestamp: Date.now(),
        });
        logger.info("Message queued - client not ready");
        return false;
      }

      // Check rate limiting
      if (!this.checkRateLimit(chatId)) {
        logger.warn(`Rate limit exceeded for chat: ${chatId}`);
        return false;
      }

      // Add typing indicator if enabled
      if (this.config.bot.features.sendTyping && options.typing !== false) {
        const chat = await this.client.getChatById(chatId);
        await chat.sendStateTyping();
        await this.delay(this.config.messageHandler.typingDelay);
      }

      // Split long messages
      const messages = this.splitMessage(message);

      for (let i = 0; i < messages.length; i++) {
        await this.client.sendMessage(chatId, messages[i]);

        // Add delay between messages
        if (i < messages.length - 1) {
          await this.delay(this.config.messageHandler.messageDelay);
        }
      }

      logger.info(`Message sent to ${chatId}`);
      return true;
    } catch (error) {
      logger.error("Error sending message:", error);

      // Retry mechanism
      if (
        options.retry !== false &&
        (options.retryCount || 0) < this.config.messageHandler.maxRetries
      ) {
        logger.info(
          `Retrying message send (attempt ${(options.retryCount || 0) + 1})`
        );

        await this.delay(this.config.messageHandler.retryDelay);

        return this.sendMessage(chatId, message, {
          ...options,
          retryCount: (options.retryCount || 0) + 1,
        });
      }

      return false;
    }
  }

  async sendMedia(chatId, media, caption = "", options = {}) {
    try {
      if (!this.isReady) {
        this.messageQueue.push({
          chatId,
          media,
          caption,
          options,
          type: "media",
          timestamp: Date.now(),
        });
        return false;
      }

      // Check rate limiting
      if (!this.checkRateLimit(chatId)) {
        logger.warn(`Rate limit exceeded for chat: ${chatId}`);
        return false;
      }

      let messageMedia;

      if (typeof media === "string") {
        // File path
        messageMedia = MessageMedia.fromFilePath(media);
      } else if (Buffer.isBuffer(media)) {
        // Buffer
        messageMedia = new MessageMedia(
          options.mimetype || "image/jpeg",
          media.toString("base64"),
          options.filename || "image.jpg"
        );
      } else {
        // Already MessageMedia object
        messageMedia = media;
      }

      await this.client.sendMessage(chatId, messageMedia, { caption });

      logger.info(`Media sent to ${chatId}`);
      return true;
    } catch (error) {
      logger.error("Error sending media:", error);
      return false;
    }
  }

  async downloadMedia(message) {
    try {
      if (!message.hasMedia) {
        return null;
      }

      const media = await message.downloadMedia();

      if (!media) {
        logger.warn("Failed to download media");
        return null;
      }

      // Validate media
      if (!this.validateMedia(media)) {
        logger.warn("Invalid media format or size");
        return null;
      }

      return media;
    } catch (error) {
      logger.error("Error downloading media:", error);
      return null;
    }
  }

  validateMedia(media) {
    const { supportedFormats, maxFileSize } = this.config.media;

    // Check format
    const format = media.mimetype.split("/")[1];
    if (!supportedFormats.includes(format)) {
      return false;
    }

    // Check size
    const buffer = Buffer.from(media.data, "base64");
    if (buffer.length > maxFileSize) {
      return false;
    }

    return true;
  }

  checkRateLimit(chatId) {
    if (!this.config.bot.features.rateLimiting) {
      return true;
    }

    const now = Date.now();
    const { rateLimitPerUser, rateLimitWindow } = this.config.security;

    if (!this.rateLimiter.has(chatId)) {
      this.rateLimiter.set(chatId, []);
    }

    const userRequests = this.rateLimiter.get(chatId);

    // Remove old requests outside the window
    const validRequests = userRequests.filter(
      (time) => now - time < rateLimitWindow
    );

    if (validRequests.length >= rateLimitPerUser) {
      return false;
    }

    validRequests.push(now);
    this.rateLimiter.set(chatId, validRequests);

    return true;
  }

  isAuthorizedUser(phoneNumber) {
    const { adminNumbers } = this.config.security;

    if (adminNumbers.length === 0) {
      return true; // No restrictions if no admin numbers set
    }

    return adminNumbers.includes(phoneNumber);
  }

  isAuthorizedGroup(groupId) {
    const { allowedGroups } = this.config.security;

    if (allowedGroups.length === 0) {
      return true; // No restrictions if no allowed groups set
    }

    return allowedGroups.includes(groupId);
  }

  splitMessage(message) {
    const { maxMessageLength } = this.config.messageHandler;

    if (message.length <= maxMessageLength) {
      return [message];
    }

    const messages = [];
    let currentMessage = "";
    const lines = message.split("\n");

    for (const line of lines) {
      if ((currentMessage + line + "\n").length > maxMessageLength) {
        if (currentMessage) {
          messages.push(currentMessage.trim());
          currentMessage = "";
        }

        if (line.length > maxMessageLength) {
          // Split very long lines
          const chunks = line.match(
            new RegExp(`.{1,${maxMessageLength - 50}}`, "g")
          );
          messages.push(...chunks);
        } else {
          currentMessage = line + "\n";
        }
      } else {
        currentMessage += line + "\n";
      }
    }

    if (currentMessage.trim()) {
      messages.push(currentMessage.trim());
    }

    return messages;
  }

  async processMessageQueue() {
    if (this.isProcessingQueue || !this.isReady) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.messageQueue.length > 0) {
        const item = this.messageQueue.shift();

        // Skip old messages (older than 5 minutes)
        if (Date.now() - item.timestamp > 300000) {
          logger.warn("Skipping old queued message");
          continue;
        }

        if (item.type === "media") {
          await this.sendMedia(
            item.chatId,
            item.media,
            item.caption,
            item.options
          );
        } else {
          await this.sendMessage(item.chatId, item.message, {
            ...item.options,
            retry: false,
          });
        }

        await this.delay(this.config.messageHandler.messageDelay);
      }
    } catch (error) {
      logger.error("Error processing message queue:", error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  async handleDisconnection(reason) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(
        "Max reconnection attempts reached. Manual intervention required."
      );
      return;
    }

    this.reconnectAttempts++;
    logger.info(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );

    await this.delay(this.config.client.restartDelay * this.reconnectAttempts);

    try {
      await this.restart();
    } catch (error) {
      logger.error("Reconnection failed:", error);
    }
  }

  async restart() {
    try {
      logger.info("Restarting WhatsApp client...");

      if (this.client) {
        await this.client.destroy();
      }

      await this.delay(2000);
      await this.initialize();
    } catch (error) {
      logger.error("Restart failed:", error);
      throw error;
    }
  }

  async getChats() {
    try {
      if (!this.isReady) {
        return [];
      }

      return await this.client.getChats();
    } catch (error) {
      logger.error("Error getting chats:", error);
      return [];
    }
  }

  async getChatById(chatId) {
    try {
      if (!this.isReady) {
        return null;
      }

      return await this.client.getChatById(chatId);
    } catch (error) {
      logger.error("Error getting chat by ID:", error);
      return null;
    }
  }

  async getContactById(contactId) {
    try {
      if (!this.isReady) {
        return null;
      }

      return await this.client.getContactById(contactId);
    } catch (error) {
      logger.error("Error getting contact by ID:", error);
      return null;
    }
  }

  getClientInfo() {
    if (!this.isReady || !this.client) {
      return null;
    }

    return {
      isReady: this.isReady,
      clientInfo: this.client.info,
      queueLength: this.messageQueue.length,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async destroy() {
    try {
      this.isReady = false;

      if (this.client) {
        await this.client.destroy();
      }

      logger.info("WhatsApp service destroyed");
    } catch (error) {
      logger.error("Error destroying WhatsApp service:", error);
    }
  }
}

module.exports = new WhatsAppService();
