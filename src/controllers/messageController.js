const { MessageMedia } = require("whatsapp-web.js");
const aiService = require("../services/aiService");
const imageService = require("../services/imageService");
const logger = require("../utils/logger");
const {
  isAuthorizedUser,
  isAuthorizedGroup,
  formatAnalysisResult,
} = require("../utils/helpers");

class MessageController {
  async handleMessage(message, client) {
    try {
      // Skip pesan dari diri sendiri
      if (message.fromMe) return;

      const chat = await message.getChat();
      const contact = await message.getContact();

      // Cek authorization
      if (chat.isGroup) {
        if (!isAuthorizedGroup(chat.id._serialized)) {
          return;
        }
      } else {
        if (!isAuthorizedUser(contact.number)) {
          return;
        }
      }

      // Handle berbagai jenis pesan
      if (message.hasMedia) {
        await this.handleMediaMessage(message, client);
      } else {
        await this.handleTextMessage(message, client);
      }
    } catch (error) {
      logger.error("Error in message controller:", error);
      await message.reply("❌ Terjadi kesalahan dalam memproses pesan.");
    }
  }

  async handleMediaMessage(message, client) {
    try {
      const media = await message.downloadMedia();

      if (!media || !media.mimetype.startsWith("image/")) {
        await message.reply("📷 Silakan kirim gambar chart untuk dianalisis.");
        return;
      }

      // Tampilkan indikator sedang memproses
      await message.reply(
        "⏳ Sedang menganalisis chart... Mohon tunggu sebentar."
      );

      // Validasi dan proses gambar
      const processedImage = await imageService.processImage(media);

      if (!processedImage) {
        await message.reply(
          "❌ Gagal memproses gambar. Pastikan gambar chart jelas dan tidak corrupt."
        );
        return;
      }

      // Analisis dengan AI
      const analysis = await aiService.analyzeChart(processedImage);

      if (!analysis) {
        await message.reply(
          "❌ Gagal menganalisis chart. Silakan coba lagi dengan gambar yang lebih jelas."
        );
        return;
      }

      // Format dan kirim hasil
      const formattedResult = formatAnalysisResult(analysis);
      await message.reply(formattedResult);

      logger.info(`Analysis completed for user: ${message.from}`);
    } catch (error) {
      logger.error("Error handling media message:", error);
      await message.reply(
        "❌ Terjadi kesalahan saat menganalisis chart. Silakan coba lagi."
      );
    }
  }

  async handleTextMessage(message, client) {
    const text = message.body.toLowerCase().trim();

    // Command help
    if (text === "/help" || text === "help") {
      const helpMessage = `
🤖 *TradingBot SMC - Panduan Penggunaan*

📊 *Cara Menggunakan:*
1. Kirim gambar chart M15 
2. Bot akan menganalisis menggunakan Smart Money Concept
3. Dapatkan rekomendasi Entry, SL, TP

⚡ *Fitur Analisis:*
- Break of Structure (BOS/CHoCH)
- Order Block & Supply/Demand
- Area Likuiditas 
- Entry Zone dengan R:R minimal 1:2

📌 *Command:*
- /help - Bantuan
- /status - Status bot
- /info - Info bot

💡 *Tips:* Pastikan chart M15 terlihat jelas dan lengkap dengan harga untuk analisis yang akurat.
            `;
      await message.reply(helpMessage);
    }

    // Command status
    else if (text === "/status") {
      const statusMessage = `
✅ *Status Bot Trading*

🔋 Status: Online
🤖 AI Service: Active
📊 Analisis: Ready
⏰ Uptime: ${process.uptime().toFixed(0)}s

📈 *Mode Analisis:*
- Timeframe: M15 Scalping
- Method: Smart Money Concept
- Risk:Reward: Minimal 1:2
            `;
      await message.reply(statusMessage);
    }

    // Command info
    else if (text === "/info") {
      const infoMessage = `
📊 *TradingBot SMC v1.0*

🎯 *Spesialisasi:*
- Smart Money Concept (SMC)
- Order Flow Analysis
- M15 Scalping Strategy

⚡ *Yang Dianalisis:*
- Market Structure
- Break of Structure (BOS/CHoCH)  
- Order Block (OB)
- Likuiditas (EQH/EQL)
- Entry Zone & Risk Management

⚠️ *Disclaimer:*
Analisis ini hanya untuk referensi. Trading mengandung risiko tinggi. Selalu gunakan proper risk management.
            `;
      await message.reply(infoMessage);
    }

    // Pesan default untuk text biasa
    else if (text.length > 10) {
      await message.reply(
        "📷 Kirim gambar chart M15 untuk mendapatkan analisis Smart Money Concept, atau ketik /help untuk panduan."
      );
    }
  }
}

module.exports = new MessageController();
