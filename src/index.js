const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs-extra");
const path = require("path");
require("dotenv").config();

const messageController = require("./controllers/messageController");
const logger = require("./utils/logger");
const { createDirectories } = require("./utils/helpers");

class TradingBot {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: "./sessions",
        clientId: process.env.WHATSAPP_SESSION_NAME,
      }),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
        ],
      },
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.on("qr", (qr) => {
      console.log("\n🔗 Scan QR Code berikut untuk login WhatsApp:");
      qrcode.generate(qr, { small: true });
    });

    this.client.on("ready", () => {
      logger.info("✅ Bot WhatsApp Trading siap digunakan!");
      console.log("✅ Bot WhatsApp Trading siap digunakan!");
    });

    this.client.on("message", async (message) => {
      try {
        await messageController.handleMessage(message, this.client);
      } catch (error) {
        logger.error("Error handling message:", error);
      }
    });

    this.client.on("disconnected", (reason) => {
      logger.warn("Bot disconnected:", reason);
      console.log("⚠️ Bot terputus:", reason);
    });
  }

  async start() {
    try {
      // Buat direktori yang diperlukan
      await createDirectories();

      // Mulai client WhatsApp
      await this.client.initialize();
      logger.info("Bot starting...");
    } catch (error) {
      logger.error("Failed to start bot:", error);
      process.exit(1);
    }
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down bot...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down bot...");
  process.exit(0);
});

// Start the bot
const bot = new TradingBot();
bot.start().catch((error) => {
  console.error("Failed to start bot:", error);
  process.exit(1);
});
