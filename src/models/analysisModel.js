const fs = require("fs-extra");
const path = require("path");
const logger = require("../utils/logger");

class AnalysisModel {
  constructor() {
    this.dataPath = path.join(__dirname, "../../data/analysis.json");
    this.initializeDataFile();
  }

  async initializeDataFile() {
    try {
      await fs.ensureDir(path.dirname(this.dataPath));

      if (!(await fs.pathExists(this.dataPath))) {
        await fs.writeJson(this.dataPath, { analyses: [] });
        logger.info("Analysis data file initialized");
      }
    } catch (error) {
      logger.error("Error initializing analysis data file:", error);
    }
  }

  async saveAnalysis(analysisData) {
    try {
      const data = await this.getAllAnalyses();

      const newAnalysis = {
        id: this.generateId(),
        timestamp: new Date().toISOString(),
        userId: analysisData.userId,
        chatId: analysisData.chatId,
        userName: analysisData.userName || "Unknown",
        imageHash: analysisData.imageHash,
        analysis: analysisData.analysis,
        marketStructure: analysisData.marketStructure,
        entryZone: analysisData.entryZone,
        stopLoss: analysisData.stopLoss,
        takeProfit: analysisData.takeProfit,
        riskReward: analysisData.riskReward,
        confidence: analysisData.confidence || "medium",
        status: "active",
      };

      data.analyses.push(newAnalysis);

      // Keep only last 1000 analyses to prevent file size growth
      if (data.analyses.length > 1000) {
        data.analyses = data.analyses.slice(-1000);
      }

      await fs.writeJson(this.dataPath, data, { spaces: 2 });
      logger.info(`Analysis saved with ID: ${newAnalysis.id}`);

      return newAnalysis;
    } catch (error) {
      logger.error("Error saving analysis:", error);
      throw error;
    }
  }

  async getAllAnalyses() {
    try {
      const data = await fs.readJson(this.dataPath);
      return data || { analyses: [] };
    } catch (error) {
      logger.error("Error reading analyses:", error);
      return { analyses: [] };
    }
  }

  async getAnalysesByUser(userId, limit = 10) {
    try {
      const data = await this.getAllAnalyses();
      return data.analyses
        .filter((analysis) => analysis.userId === userId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    } catch (error) {
      logger.error("Error getting user analyses:", error);
      return [];
    }
  }

  async getAnalysisById(id) {
    try {
      const data = await this.getAllAnalyses();
      return data.analyses.find((analysis) => analysis.id === id);
    } catch (error) {
      logger.error("Error getting analysis by ID:", error);
      return null;
    }
  }

  async updateAnalysisStatus(id, status, result = null) {
    try {
      const data = await this.getAllAnalyses();
      const analysisIndex = data.analyses.findIndex(
        (analysis) => analysis.id === id
      );

      if (analysisIndex !== -1) {
        data.analyses[analysisIndex].status = status;
        data.analyses[analysisIndex].updatedAt = new Date().toISOString();

        if (result) {
          data.analyses[analysisIndex].result = result;
        }

        await fs.writeJson(this.dataPath, data, { spaces: 2 });
        logger.info(`Analysis ${id} status updated to: ${status}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Error updating analysis status:", error);
      return false;
    }
  }

  async getAnalysisStats(userId = null) {
    try {
      const data = await this.getAllAnalyses();
      let analyses = data.analyses;

      if (userId) {
        analyses = analyses.filter((analysis) => analysis.userId === userId);
      }

      const total = analyses.length;
      const active = analyses.filter((a) => a.status === "active").length;
      const completed = analyses.filter((a) => a.status === "completed").length;
      const failed = analyses.filter((a) => a.status === "failed").length;

      // Get analysis by timeframe (last 24h, 7days, 30days)
      const now = new Date();
      const last24h = analyses.filter(
        (a) => now - new Date(a.timestamp) <= 24 * 60 * 60 * 1000
      ).length;

      const last7days = analyses.filter(
        (a) => now - new Date(a.timestamp) <= 7 * 24 * 60 * 60 * 1000
      ).length;

      const last30days = analyses.filter(
        (a) => now - new Date(a.timestamp) <= 30 * 24 * 60 * 60 * 1000
      ).length;

      return {
        total,
        active,
        completed,
        failed,
        timeframe: {
          last24h,
          last7days,
          last30days,
        },
      };
    } catch (error) {
      logger.error("Error getting analysis stats:", error);
      return null;
    }
  }

  async deleteOldAnalyses(daysOld = 30) {
    try {
      const data = await this.getAllAnalyses();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const filteredAnalyses = data.analyses.filter(
        (analysis) => new Date(analysis.timestamp) > cutoffDate
      );

      const deletedCount = data.analyses.length - filteredAnalyses.length;

      if (deletedCount > 0) {
        data.analyses = filteredAnalyses;
        await fs.writeJson(this.dataPath, data, { spaces: 2 });
        logger.info(`Deleted ${deletedCount} old analyses`);
      }

      return deletedCount;
    } catch (error) {
      logger.error("Error deleting old analyses:", error);
      return 0;
    }
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

module.exports = new AnalysisModel();
