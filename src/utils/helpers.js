const fs = require("fs-extra");
const path = require("path");
const moment = require("moment");

// Buat direktori yang diperlukan
async function createDirectories() {
  const directories = ["sessions", "uploads", "logs"];

  for (const dir of directories) {
    await fs.ensureDir(path.join(__dirname, `../../${dir}`));
  }
}

// Cek apakah user diizinkan
function isAuthorizedUser(phoneNumber) {
  if (!process.env.ADMIN_NUMBERS) return true;

  const allowedNumbers = process.env.ADMIN_NUMBERS.split(",");
  return allowedNumbers.includes(phoneNumber);
}

// Cek apakah group diizinkan
function isAuthorizedGroup(groupId) {
  if (!process.env.ALLOWED_GROUPS) return true;

  const allowedGroups = process.env.ALLOWED_GROUPS.split(",");
  return allowedGroups.includes(groupId);
}

// Format hasil analisis
function formatAnalysisResult(analysis) {
  const timestamp = moment().format("DD/MM/YYYY HH:mm");

  return `
📊 *Analisis Smart Money Concept*
🕒 ${timestamp}

${analysis}

⚠️ *Disclaimer:* Analisis ini hanya referensi trading. Gunakan manajemen risiko yang proper dan trading dengan dana yang mampu Anda tanggung kerugiannya.

🤖 *TradingBot SMC* - Scalping M15 Assistant
    `.trim();
}

// Validasi format gambar
function isValidImageFormat(mimetype) {
  const supportedFormats = (
    process.env.SUPPORTED_FORMATS || "jpg,jpeg,png,webp"
  ).split(",");
  const fileExtension = mimetype.split("/")[1];

  return supportedFormats.includes(fileExtension);
}

// Generate unique filename
function generateFilename(extension = "jpg") {
  const timestamp = moment().format("YYYYMMDD-HHmmss");
  const random = Math.random().toString(36).substring(2, 8);

  return `chart-${timestamp}-${random}.${extension}`;
}

// Format angka ke format trading
function formatPrice(price) {
  if (typeof price !== "number") return price;

  return price.toFixed(5);
}

module.exports = {
  createDirectories,
  isAuthorizedUser,
  isAuthorizedGroup,
  formatAnalysisResult,
  isValidImageFormat,
  generateFilename,
  formatPrice,
};
