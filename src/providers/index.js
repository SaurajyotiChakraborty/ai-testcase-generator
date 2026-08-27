const { ClaudeProvider } = require("./ClaudeProvider");
const { OpenAIProvider } = require("./OpenAIProvider");
const { GeminiProvider } = require("./GeminiProvider");

function getProvider(providerName = "gemini", apiKey, model) {
    const name = providerName.toLowerCase();
    const key = apiKey
        || process.env[`${name.toUpperCase()}_API_KEY`]
        || process.env.GEMINI_API_KEY
        || process.env.OPENAI_API_KEY
        || process.env.ANTHROPIC_API_KEY;

    if (!key) {
        throw new Error(
            `API key missing for provider "${name}". Please provide it via CLI flag (--api-key) or environment variable (${name.toUpperCase()}_API_KEY).`
        );
    }

    switch (name) {
        case "claude":
        case "anthropic":
            return new ClaudeProvider(key, model);
        case "openai":
        case "gpt":
            return new OpenAIProvider(key, model);
        case "gemini":
        case "google":
            return new GeminiProvider(key, model);
        default:
            throw new Error(`Unsupported AI provider "${providerName}". Supported providers: gemini, openai, claude.`);
    }
}

module.exports = {
    getProvider,
    ClaudeProvider,
    OpenAIProvider,
    GeminiProvider
};
