const OpenAI = require("openai");
const logger = require("../utils/logger");
const { SMC_ANALYSIS_PROMPT } = require("../utils/constants");

class AIService {
  constructor() {
    // Inisialisasi OpenAI atau Gemini
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.provider = "openai";
    } else {
      throw new Error("No AI API key provided");
    }
  }

  async analyzeChart(imageBuffer) {
    try {
      if (this.provider === "openai") {
        return await this.analyzeWithOpenAI(imageBuffer);
      } else {
        return await this.analyzeWithGemini(imageBuffer);
      }
    } catch (error) {
      logger.error("AI analysis error:", error);
      return null;
    }
  }

  async analyzeWithOpenAI(imageBuffer) {
    try {
      const base64Image = imageBuffer.toString("base64");

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: SMC_ANALYSIS_PROMPT,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });

      return response.choices[0].message.content;
    } catch (error) {
      logger.error("OpenAI analysis error:", error);
      throw error;
    }
  }

  async analyzeWithGemini(imageBuffer) {
    try {
      const model = this.genAI.getGenerativeModel({
        model: "gemini-pro-vision",
      });

      const imagePart = {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType: "image/jpeg",
        },
      };

      const result = await model.generateContent([
        SMC_ANALYSIS_PROMPT,
        imagePart,
      ]);
      const response = await result.response;

      return response.text();
    } catch (error) {
      logger.error("Gemini analysis error:", error);
      throw error;
    }
  }
}

module.exports = new AIService();
