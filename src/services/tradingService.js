const logger = require("../utils/logger");
const { TRADING_TERMS } = require("../utils/constants");

class TradingService {
  constructor() {
    this.analysisCache = new Map();
    this.cacheTTL = 3600000; // 1 hour
    this.supportedTimeframes = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];
    this.defaultTimeframe = "M15";
    this.minRiskReward = 1.2;
    this.maxRiskReward = 10;
  }

  /**
   * Parse and extract trading analysis from AI response
   */
  parseAnalysisResponse(aiResponse) {
    try {
      const analysis = {
        timestamp: new Date().toISOString(),
        marketStructure: this.extractMarketStructure(aiResponse),
        orderBlocks: this.extractOrderBlocks(aiResponse),
        liquidity: this.extractLiquidity(aiResponse),
        entryZone: this.extractEntryZone(aiResponse),
        stopLoss: this.extractStopLoss(aiResponse),
        takeProfit: this.extractTakeProfit(aiResponse),
        riskReward: null,
        confidence: this.extractConfidence(aiResponse),
        notes: this.extractNotes(aiResponse),
        rawAnalysis: aiResponse,
        tradingPlan: null,
      };

      // Calculate risk reward ratio
      analysis.riskReward = this.calculateRiskReward(
        analysis.entryZone,
        analysis.stopLoss,
        analysis.takeProfit
      );

      // Generate trading plan
      analysis.tradingPlan = this.generateTradingPlan(analysis);

      // Validate analysis
      const validation = this.validateAnalysis(analysis);
      analysis.isValid = validation.isValid;
      analysis.validationErrors = validation.errors;

      return analysis;
    } catch (error) {
      logger.error("Error parsing analysis response:", error);
      return null;
    }
  }

  extractMarketStructure(text) {
    const patterns = [
      /struktur\s+market[:\s]+([^\n]+)/i,
      /market\s+structure[:\s]+([^\n]+)/i,
      /trend[:\s]+([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const structure = match[1].trim().toLowerCase();

        if (
          structure.includes("bullish") ||
          structure.includes("naik") ||
          structure.includes("uptrend")
        ) {
          return { direction: "bullish", confidence: "high" };
        } else if (
          structure.includes("bearish") ||
          structure.includes("turun") ||
          structure.includes("downtrend")
        ) {
          return { direction: "bearish", confidence: "high" };
        } else if (
          structure.includes("sideways") ||
          structure.includes("ranging") ||
          structure.includes("consolidation")
        ) {
          return { direction: "sideways", confidence: "medium" };
        }
      }
    }

    return { direction: "unknown", confidence: "low" };
  }

  extractOrderBlocks(text) {
    const patterns = [
      /order\s+block[:\s]+([^\n]+)/i,
      /area\s+order\s+block[:\s]+([^\n]+)/i,
      /ob[:\s]+([^\n]+)/i,
      /supply[:\s]+([^\n]+)/i,
      /demand[:\s]+([^\n]+)/i,
    ];

    const orderBlocks = [];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const obText = match[1].trim();
        const prices = this.extractPrices(obText);

        if (prices.length > 0) {
          orderBlocks.push({
            type: obText.toLowerCase().includes("supply") ? "supply" : "demand",
            zone: prices,
            description: obText,
          });
        }
      }
    }

    return orderBlocks;
  }

  extractLiquidity(text) {
    const patterns = [
      /likuiditas[:\s]+([^\n]+)/i,
      /liquidity[:\s]+([^\n]+)/i,
      /equal\s+high[:\s]+([^\n]+)/i,
      /equal\s+low[:\s]+([^\n]+)/i,
      /eqh[:\s]+([^\n]+)/i,
      /eql[:\s]+([^\n]+)/i,
    ];

    const liquidityZones = [];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const liqText = match[1].trim();
        const prices = this.extractPrices(liqText);

        liquidityZones.push({
          description: liqText,
          levels: prices,
          type: this.determineLiquidityType(liqText),
        });
      }
    }

    return liquidityZones;
  }

  extractEntryZone(text) {
    const patterns = [
      /entry\s+potensial[:\s]+([^\n]+)/i,
      /entry[:\s]+([^\n]+)/i,
      /buy[:\s]+([^\n]+)/i,
      /sell[:\s]+([^\n]+)/i,
      /long[:\s]+([^\n]+)/i,
      /short[:\s]+([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const entryText = match[1].trim();
        const prices = this.extractPrices(entryText);

        return {
          direction: this.determineTradeDirection(entryText),
          price: prices[0] || null,
          zone: prices,
          description: entryText,
          confidence: this.extractConfidenceFromText(entryText),
        };
      }
    }

    return null;
  }

  extractStopLoss(text) {
    const patterns = [
      /sl[:\s]+([^\n]+)/i,
      /stop\s+loss[:\s]+([^\n]+)/i,
      /stop[:\s]+([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const slText = match[1].trim();
        const prices = this.extractPrices(slText);

        return {
          price: prices[0] || null,
          description: slText,
        };
      }
    }

    return null;
  }

  extractTakeProfit(text) {
    const patterns = [
      /tp[:\s]+([^\n]+)/i,
      /take\s+profit[:\s]+([^\n]+)/i,
      /target[:\s]+([^\n]+)/i,
    ];

    const targets = [];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const tpText = match[1].trim();
        const prices = this.extractPrices(tpText);

        prices.forEach((price, index) => {
          targets.push({
            level: index + 1,
            price: price,
            description: tpText,
          });
        });
      }
    }

    return targets.length > 0 ? targets : null;
  }

  extractPrices(text) {
    // Extract price patterns like 1.2345, 12345.67, etc.
    const pricePatterns = [
      /\d+\.\d{4,5}/g, // Forex prices (4-5 decimals)
      /\d+\.\d{2,3}/g, // Regular prices (2-3 decimals)
      /\d{4,6}/g, // Whole numbers (indices, crypto)
    ];

    const prices = [];

    for (const pattern of pricePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          const price = parseFloat(match);
          if (!isNaN(price) && !prices.includes(price)) {
            prices.push(price);
          }
        });
      }
    }

    return prices.sort((a, b) => b - a); // Sort descending
  }

  extractConfidence(text) {
    const confidenceKeywords = {
      high: ["sangat yakin", "confident", "strong", "tinggi", "kuat"],
      medium: ["cukup yakin", "moderate", "sedang", "possible"],
      low: ["kurang yakin", "weak", "rendah", "perlu konfirmasi", "hati-hati"],
    };

    const lowerText = text.toLowerCase();

    for (const [level, keywords] of Object.entries(confidenceKeywords)) {
      if (keywords.some((keyword) => lowerText.includes(keyword))) {
        return level;
      }
    }

    return "medium"; // Default
  }

  extractConfidenceFromText(text) {
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes("strong") ||
      lowerText.includes("kuat") ||
      lowerText.includes("yakin")
    ) {
      return "high";
    } else if (
      lowerText.includes("weak") ||
      lowerText.includes("lemah") ||
      lowerText.includes("hati-hati")
    ) {
      return "low";
    }

    return "medium";
  }

  extractNotes(text) {
    const patterns = [
      /catatan[:\s]+([^\n]+)/i,
      /notes[:\s]+([^\n]+)/i,
      /perhatian[:\s]+([^\n]+)/i,
      /warning[:\s]+([^\n]+)/i,
    ];

    const notes = [];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        notes.push(match[1].trim());
      }
    }

    return notes.length > 0 ? notes.join(". ") : null;
  }

  determineTradeDirection(text) {
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes("buy") ||
      lowerText.includes("long") ||
      lowerText.includes("beli")
    ) {
      return "buy";
    } else if (
      lowerText.includes("sell") ||
      lowerText.includes("short") ||
      lowerText.includes("jual")
    ) {
      return "sell";
    }

    return "unknown";
  }

  determineLiquidityType(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes("equal high") || lowerText.includes("eqh")) {
      return "equal_high";
    } else if (lowerText.includes("equal low") || lowerText.includes("eql")) {
      return "equal_low";
    } else if (lowerText.includes("sweep") || lowerText.includes("raid")) {
      return "liquidity_sweep";
    }

    return "general";
  }

  calculateRiskReward(entryZone, stopLoss, takeProfit) {
    try {
      if (!entryZone || !stopLoss || !takeProfit) {
        return null;
      }

      const entryPrice = entryZone.price || entryZone.zone?.[0];
      const slPrice = stopLoss.price;
      const tpPrice = Array.isArray(takeProfit)
        ? takeProfit[0]?.price
        : takeProfit.price;

      if (!entryPrice || !slPrice || !tpPrice) {
        return null;
      }

      const risk = Math.abs(entryPrice - slPrice);
      const reward = Math.abs(tpPrice - entryPrice);

      if (risk === 0) return null;

      const ratio = reward / risk;

      return {
        ratio: parseFloat(ratio.toFixed(2)),
        risk: parseFloat(risk.toFixed(5)),
        reward: parseFloat(reward.toFixed(5)),
        isAcceptable: ratio >= this.minRiskReward,
      };
    } catch (error) {
      logger.error("Error calculating risk reward:", error);
      return null;
    }
  }

  generateTradingPlan(analysis) {
    try {
      const plan = {
        setup: this.generateSetupDescription(analysis),
        entryRules: this.generateEntryRules(analysis),
        exitRules: this.generateExitRules(analysis),
        riskManagement: this.generateRiskManagement(analysis),
        scenarios: this.generateScenarios(analysis),
      };

      return plan;
    } catch (error) {
      logger.error("Error generating trading plan:", error);
      return null;
    }
  }

  generateSetupDescription(analysis) {
    const structure = analysis.marketStructure?.direction || "unknown";
    const confidence = analysis.confidence || "medium";

    return (
      `Market menunjukkan struktur ${structure} dengan confidence ${confidence}. ` +
      `Setup ini cocok untuk scalping M15 dengan pendekatan Smart Money Concept.`
    );
  }

  generateEntryRules(analysis) {
    const rules = [];

    if (analysis.entryZone) {
      rules.push(`Entry di zona ${analysis.entryZone.description}`);

      if (analysis.entryZone.direction === "buy") {
        rules.push(
          "Tunggu konfirmasi bullish (candle hijau, break resistance)"
        );
      } else if (analysis.entryZone.direction === "sell") {
        rules.push("Tunggu konfirmasi bearish (candle merah, break support)");
      }
    }

    if (analysis.orderBlocks?.length > 0) {
      rules.push("Perhatikan reaksi di area Order Block");
    }

    return rules;
  }

  generateExitRules(analysis) {
    const rules = [];

    if (analysis.stopLoss) {
      rules.push(`Stop Loss: ${analysis.stopLoss.description}`);
    }

    if (analysis.takeProfit) {
      if (Array.isArray(analysis.takeProfit)) {
        analysis.takeProfit.forEach((tp, index) => {
          rules.push(`TP${tp.level}: ${tp.description}`);
        });
      } else {
        rules.push(`Take Profit: ${analysis.takeProfit.description}`);
      }
    }

    rules.push("Close posisi jika ada perubahan struktur market");

    return rules;
  }

  generateRiskManagement(analysis) {
    const rules = [];

    rules.push("Maksimal 2% risk per trade");
    rules.push("Gunakan proper position sizing");

    if (analysis.riskReward?.ratio) {
      rules.push(`Target R:R minimum ${analysis.riskReward.ratio}:1`);
    }

    rules.push("Jangan averaging down pada loss");
    rules.push("Follow trading plan dengan disiplin");

    return rules;
  }

  generateScenarios(analysis) {
    const scenarios = {
      bullish: "Jika harga break ke atas, look for continuation pattern",
      bearish: "Jika harga break ke bawah, anticipate further decline",
      sideways: "Jika ranging, trade the boundaries dengan tight SL",
    };

    return scenarios;
  }

  validateAnalysis(analysis) {
    const errors = [];

    // Check required fields
    if (!analysis.entryZone) {
      errors.push("Entry zone not identified");
    }

    if (!analysis.stopLoss) {
      errors.push("Stop loss not specified");
    }

    if (!analysis.takeProfit) {
      errors.push("Take profit not specified");
    }

    // Check risk reward
    if (analysis.riskReward && analysis.riskReward.ratio < this.minRiskReward) {
      errors.push(
        `Risk:Reward ratio ${analysis.riskReward.ratio} below minimum ${this.minRiskReward}`
      );
    }

    // Check price validity
    if (analysis.entryZone?.price && analysis.stopLoss?.price) {
      const entryPrice = analysis.entryZone.price;
      const slPrice = analysis.stopLoss.price;

      if (entryPrice === slPrice) {
        errors.push("Entry and stop loss prices are the same");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  formatAnalysisForDisplay(analysis) {
    if (!analysis) {
      return "Analisis tidak tersedia";
    }

    const sections = [];

    // Header
    sections.push("🔎 *Analisa Scalping M15*");
    sections.push(`⏰ ${new Date(analysis.timestamp).toLocaleString("id-ID")}`);
    sections.push("");

    // Market Structure
    if (analysis.marketStructure) {
      sections.push(
        `📊 *Struktur Market:* ${analysis.marketStructure.direction.toUpperCase()}`
      );
    }

    // Order Blocks
    if (analysis.orderBlocks?.length > 0) {
      const obDescriptions = analysis.orderBlocks
        .map((ob) => ob.description)
        .join(", ");
      sections.push(`🟦 *Area Order Block:* ${obDescriptions}`);
    }

    // Liquidity
    if (analysis.liquidity?.length > 0) {
      const liqDescriptions = analysis.liquidity
        .map((liq) => liq.description)
        .join(", ");
      sections.push(`💧 *Likuiditas:* ${liqDescriptions}`);
    }

    // Entry Zone
    if (analysis.entryZone) {
      sections.push(`🎯 *Entry Potensial:* ${analysis.entryZone.description}`);
    }

    // Stop Loss
    if (analysis.stopLoss) {
      sections.push(`🛑 *SL:* ${analysis.stopLoss.description}`);
    }

    // Take Profit
    if (analysis.takeProfit) {
      if (Array.isArray(analysis.takeProfit)) {
        const tpDescriptions = analysis.takeProfit
          .map((tp) => `TP${tp.level}: ${tp.price}`)
          .join(", ");
        sections.push(`🎯 *TP:* ${tpDescriptions}`);
      } else {
        sections.push(`🎯 *TP:* ${analysis.takeProfit.description}`);
      }
    }

    // Risk Reward
    if (analysis.riskReward) {
      sections.push(`⚖️ *R:R Ratio:* 1:${analysis.riskReward.ratio}`);
    }

    // Notes
    if (analysis.notes) {
      sections.push(`📝 *Catatan:* ${analysis.notes}`);
    }

    // Validation warnings
    if (!analysis.isValid && analysis.validationErrors?.length > 0) {
      sections.push("");
      sections.push("⚠️ *Peringatan:*");
      analysis.validationErrors.forEach((error) => {
        sections.push(`• ${error}`);
      });
    }

    return sections.join("\n");
  }

  getCachedAnalysis(imageHash) {
    const cached = this.analysisCache.get(imageHash);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.analysis;
    }

    return null;
  }

  setCachedAnalysis(imageHash, analysis) {
    this.analysisCache.set(imageHash, {
      analysis,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    this.cleanCache();
  }

  cleanCache() {
    const now = Date.now();

    for (const [key, value] of this.analysisCache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.analysisCache.delete(key);
      }
    }
  }

  generateImageHash(buffer) {
    const crypto = require("crypto");
    return crypto.createHash("md5").update(buffer).digest("hex");
  }

  getAnalysisStats() {
    return {
      cacheSize: this.analysisCache.size,
      supportedTimeframes: this.supportedTimeframes,
      defaultTimeframe: this.defaultTimeframe,
      minRiskReward: this.minRiskReward,
      maxRiskReward: this.maxRiskReward,
    };
  }
}

module.exports = new TradingService();
