const fs = require("fs-extra");
const path = require("path");
const logger = require("../utils/logger");

class DatabaseConfig {
  constructor() {
    this.dataDir = path.join(__dirname, "../../data");
    this.dbFiles = {
      analysis: "analysis.json",
      users: "users.json",
      groups: "groups.json",
      settings: "settings.json",
    };

    this.initialize();
  }

  async initialize() {
    try {
      // Ensure data directory exists
      await fs.ensureDir(this.dataDir);

      // Initialize all database files
      for (const [key, filename] of Object.entries(this.dbFiles)) {
        await this.initializeFile(key, filename);
      }

      logger.info("Database configuration initialized");
    } catch (error) {
      logger.error("Database initialization error:", error);
      throw error;
    }
  }

  async initializeFile(type, filename) {
    try {
      const filePath = path.join(this.dataDir, filename);

      if (!(await fs.pathExists(filePath))) {
        let initialData = {};

        switch (type) {
          case "analysis":
            initialData = { analyses: [] };
            break;
          case "users":
            initialData = {
              users: [],
              totalUsers: 0,
              lastUpdated: new Date().toISOString(),
            };
            break;
          case "groups":
            initialData = {
              groups: [],
              totalGroups: 0,
              lastUpdated: new Date().toISOString(),
            };
            break;
          case "settings":
            initialData = {
              botSettings: {
                maxAnalysisPerDay: 50,
                allowedFileSize: 5242880, // 5MB
                supportedFormats: ["jpg", "jpeg", "png", "webp"],
                analysisTimeout: 30000,
                riskRewardMin: 1.5,
                autoDeleteOldData: true,
                dataRetentionDays: 30,
              },
              created: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
            };
            break;
        }

        await fs.writeJson(filePath, initialData, { spaces: 2 });
        logger.info(`Database file ${filename} initialized`);
      }
    } catch (error) {
      logger.error(`Error initializing ${filename}:`, error);
      throw error;
    }
  }

  async readData(type) {
    try {
      const filename = this.dbFiles[type];
      if (!filename) {
        throw new Error(`Invalid data type: ${type}`);
      }

      const filePath = path.join(this.dataDir, filename);
      return await fs.readJson(filePath);
    } catch (error) {
      logger.error(`Error reading ${type} data:`, error);
      throw error;
    }
  }

  async writeData(type, data) {
    try {
      const filename = this.dbFiles[type];
      if (!filename) {
        throw new Error(`Invalid data type: ${type}`);
      }

      const filePath = path.join(this.dataDir, filename);
      await fs.writeJson(filePath, data, { spaces: 2 });
      logger.info(`Data written to ${filename}`);
    } catch (error) {
      logger.error(`Error writing ${type} data:`, error);
      throw error;
    }
  }

  async backupData() {
    try {
      const backupDir = path.join(this.dataDir, "backups");
      await fs.ensureDir(backupDir);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(backupDir, `backup-${timestamp}`);

      await fs.copy(this.dataDir, backupPath, {
        filter: (src) => !src.includes("backups"),
      });

      logger.info(`Data backup created: ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.error("Backup creation error:", error);
      throw error;
    }
  }

  async cleanupOldBackups(maxBackups = 5) {
    try {
      const backupDir = path.join(this.dataDir, "backups");

      if (!(await fs.pathExists(backupDir))) {
        return;
      }

      const backups = await fs.readdir(backupDir);
      const backupPaths = backups
        .map((name) => ({
          name,
          path: path.join(backupDir, name),
          time: fs.statSync(path.join(backupDir, name)).mtime,
        }))
        .sort((a, b) => b.time - a.time);

      if (backupPaths.length > maxBackups) {
        const toDelete = backupPaths.slice(maxBackups);

        for (const backup of toDelete) {
          await fs.remove(backup.path);
          logger.info(`Old backup deleted: ${backup.name}`);
        }
      }
    } catch (error) {
      logger.error("Backup cleanup error:", error);
    }
  }

  getDataPath(type) {
    const filename = this.dbFiles[type];
    if (!filename) {
      throw new Error(`Invalid data type: ${type}`);
    }

    return path.join(this.dataDir, filename);
  }
}

module.exports = new DatabaseConfig();
