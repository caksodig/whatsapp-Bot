const sharp = require("sharp");
const fs = require("fs-extra");
const path = require("path");
const logger = require("../utils/logger");

class ImageService {
  async processImage(media) {
    try {
      const buffer = Buffer.from(media.data, "base64");

      // Validasi ukuran file
      if (buffer.length > parseInt(process.env.MAX_IMAGE_SIZE || "5242880")) {
        logger.warn("Image too large");
        return null;
      }

      // Proses dengan Sharp untuk optimasi
      const processedBuffer = await sharp(buffer)
        .resize(1920, 1080, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toBuffer();

      logger.info("Image processed successfully");
      return processedBuffer;
    } catch (error) {
      logger.error("Image processing error:", error);
      return null;
    }
  }

  async saveTemporaryImage(buffer, filename) {
    try {
      const uploadPath = path.join(__dirname, "../../uploads");
      await fs.ensureDir(uploadPath);

      const filePath = path.join(uploadPath, filename);
      await fs.writeFile(filePath, buffer);

      return filePath;
    } catch (error) {
      logger.error("Error saving temporary image:", error);
      return null;
    }
  }

  async cleanupTemporaryFiles() {
    try {
      const uploadPath = path.join(__dirname, "../../uploads");
      const files = await fs.readdir(uploadPath);

      for (const file of files) {
        const filePath = path.join(uploadPath, file);
        const stats = await fs.stat(filePath);

        // Hapus file yang lebih dari 1 jam
        if (Date.now() - stats.mtime.getTime() > 3600000) {
          await fs.unlink(filePath);
          logger.info(`Cleaned up temporary file: ${file}`);
        }
      }
    } catch (error) {
      logger.error("Cleanup error:", error);
    }
  }
}

module.exports = new ImageService();
