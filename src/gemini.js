require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

function getAIClient(apiKey) {
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is missing. Please provide it via the --api-key flag, aitest.config.js, or environment variable.");
    }
    return new GoogleGenAI({ apiKey });
}

module.exports = {
    getAIClient
};