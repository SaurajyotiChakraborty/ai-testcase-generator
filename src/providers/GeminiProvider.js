const { ProviderInterface } = require("./ProviderInterface");
const { GoogleGenAI } = require("@google/genai");

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class GeminiProvider extends ProviderInterface {
    constructor(apiKey, model = "gemini-3.6-flash") {
        super(apiKey, model);
    }

    async generate({ systemPrompt, userPrompt, maxTokens = 8192, temperature = 0.2 }) {
        const ai = new GoogleGenAI({ apiKey: this.apiKey });
        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

        let attempts = 0;
        const maxAttempts = 4;
        let lastError;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                const response = await ai.models.generateContent({
                    model: this.model,
                    contents: fullPrompt,
                    config: {
                        temperature,
                        maxOutputTokens: maxTokens
                    }
                });

                return response.text || "";
            } catch (error) {
                lastError = error;
                const msg = error.message || "";

                if (msg.includes("401") || msg.includes("API key")) {
                    throw new Error("Gemini Auth Error: Invalid API key provided.");
                }

                if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
                    if (attempts < maxAttempts) {
                        const waitMs = attempts * 5000;
                        console.log(`  ⏳ Gemini Rate Limit (429) encountered. Retrying in ${waitMs / 1000}s (Attempt ${attempts}/${maxAttempts})...`);
                        await delay(waitMs);
                        continue;
                    }
                    throw new Error("Gemini Rate Limit Exceeded: Rate limit persisted after retries. Please wait a minute or check your quota.");
                }

                throw new Error(`Gemini API Error: ${msg}`);
            }
        }

        throw lastError;
    }
}

module.exports = { GeminiProvider };
