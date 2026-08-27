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
    if (provider === "gemini" && process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
    if (provider === "openai" && process.env.OPENAI_MODEL) return process.env.OPENAI_MODEL;
    if (provider === "anthropic" && process.env.ANTHROPIC_MODEL) return process.env.ANTHROPIC_MODEL;

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
            return await callGemini(prompt, apiKey, model, options);
        case "openai":
            return await callOpenAI(prompt, apiKey, model, options);
        case "anthropic":
            return await callAnthropic(prompt, apiKey, model, options);
        default:
            throw new Error(`Unknown provider "${provider}". Supported: gemini, openai, anthropic`);
    }
}

/* ===================== GEMINI ===================== */

async function callGemini(prompt, apiKey, model, options = {}) {
    const { GoogleGenAI } = require("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are an expert software test engineer. Generate only raw test code suitable for a ${options.ext || '.js'} file. Do not include markdown formatting. 
When generating tests for React components using @testing-library/react, always include \`import '@testing-library/jest-dom';\` at the top of the file so matchers like toBeInTheDocument and toHaveClass are available.
When asserting props on mocked React components, DO NOT use \`toHaveBeenCalledWith\`. Instead, verify the first argument directly using \`expect(Component.mock.calls[0][0]).toEqual(expect.objectContaining({...}))\` to avoid issues with React passing \`undefined\` as a second argument.`;

    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            systemInstruction: systemPrompt
        }
    });

    return response.text || "";
}

/* ===================== OPENAI ===================== */

async function callOpenAI(prompt, apiKey, model, options = {}) {
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

    const systemPrompt = `You are an expert software test engineer. Generate only raw test code suitable for a ${options.ext || '.js'} file. Do not include markdown formatting. 
When generating tests for React components using @testing-library/react, always include \`import '@testing-library/jest-dom';\` at the top of the file so matchers like toBeInTheDocument and toHaveClass are available.
When asserting props on mocked React components, DO NOT use \`toHaveBeenCalledWith\`. Instead, verify the first argument directly using \`expect(Component.mock.calls[0][0]).toEqual(expect.objectContaining({...}))\` to avoid issues with React passing \`undefined\` as a second argument.`;

    const response = await client.chat.completions.create({
        model: model,
        messages: [
            {
                role: "system",
                content: systemPrompt
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

async function callAnthropic(prompt, apiKey, model, options = {}) {
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

    const systemPrompt = `You are an expert software test engineer. Generate only raw test code suitable for a ${options.ext || '.js'} file. Do not include markdown formatting. 
When generating tests for React components using @testing-library/react, always include \`import '@testing-library/jest-dom';\` at the top of the file so matchers like toBeInTheDocument and toHaveClass are available.
When asserting props on mocked React components, DO NOT use \`toHaveBeenCalledWith\`. Instead, verify the first argument directly using \`expect(Component.mock.calls[0][0]).toEqual(expect.objectContaining({...}))\` to avoid issues with React passing \`undefined\` as a second argument.`;

    const response = await client.messages.create({
        model: model,
        max_tokens: 8192,
        messages: [
            {
                role: "user",
                content: prompt
            }
        ],
        system: systemPrompt
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
    
