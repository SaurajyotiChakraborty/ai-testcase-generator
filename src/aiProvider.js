/**
 * AI Provider Abstraction Layer
 * 
 * Supports: Google Gemini, OpenAI (ChatGPT), Anthropic (Claude)
 * Users only need to install the SDK for the provider they want to use.
 */

// Default models per provider (latest as of August 2026)
const DEFAULT_MODELS = {
    gemini: "gemini-3.6-flash",
    openai: "gpt-5.6-luna",
    anthropic: "claude-sonnet-5"
};

/**
 * Returns the default model for a given provider.
 */
function getDefaultModel(provider) {
    return DEFAULT_MODELS[provider] || DEFAULT_MODELS.gemini;
}

/**
 * Generates text content using the specified AI provider.
 * @param {string} prompt - The prompt to send
 * @param {object} options - { provider, apiKey, model }
 * @returns {Promise<string>} The generated text response
 */
async function generateWithAI(prompt, options = {}) {
    const provider = options.provider || "gemini";
    const apiKey = options.apiKey;
    const model = options.model || getDefaultModel(provider);

    if (!apiKey) {
        throw new Error(
            `API key is missing. Please provide it via:\n` +
            `  --api-key <key>\n` +
            `  aitest.config.js { apiKey: "..." }\n` +
            `  Environment variable: GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY`
        );
    }

    switch (provider) {
        case "gemini":
            return await callGemini(prompt, apiKey, model);
        case "openai":
            return await callOpenAI(prompt, apiKey, model);
        case "anthropic":
            return await callAnthropic(prompt, apiKey, model);
        default:
            throw new Error(`Unknown provider "${provider}". Supported: gemini, openai, anthropic`);
    }
}

/* ===================== GEMINI ===================== */

async function callGemini(prompt, apiKey, model) {
    const { GoogleGenAI } = require("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
        model: model,
        contents: prompt
    });

    return response.text || "";
}

/* ===================== OPENAI ===================== */

async function callOpenAI(prompt, apiKey, model) {
    let OpenAI;
    try {
        OpenAI = require("openai");
    } catch (e) {
        throw new Error(
            `The "openai" package is not installed.\n` +
            `To use OpenAI/ChatGPT as your provider, run:\n\n` +
            `  npm install openai\n`
        );
    }

    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
        model: model,
        messages: [
            {
                role: "system",
                content: "You are an expert software test engineer. Generate only raw JavaScript test code. Do not include markdown formatting."
            },
            {
                role: "user",
                content: prompt
            }
        ],
        temperature: 0.3
    });

    return response.choices[0]?.message?.content || "";
}

/* ===================== ANTHROPIC ===================== */

async function callAnthropic(prompt, apiKey, model) {
    let Anthropic;
    try {
        ({ default: Anthropic } = require("@anthropic-ai/sdk"));
    } catch (e) {
        try {
            Anthropic = require("@anthropic-ai/sdk");
        } catch (e2) {
            throw new Error(
                `The "@anthropic-ai/sdk" package is not installed.\n` +
                `To use Anthropic/Claude as your provider, run:\n\n` +
                `  npm install @anthropic-ai/sdk\n`
            );
        }
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
        model: model,
        max_tokens: 8192,
        messages: [
            {
                role: "user",
                content: prompt
            }
        ],
        system: "You are an expert software test engineer. Generate only raw JavaScript test code. Do not include markdown formatting."
    });

    // Claude returns content as an array of content blocks
    const textBlock = response.content.find(block => block.type === "text");
    return textBlock?.text || "";
}

module.exports = {
    generateWithAI,
    getDefaultModel,
    DEFAULT_MODELS
};
