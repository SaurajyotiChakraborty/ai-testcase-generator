/**
 * Abstract Base Class for AI Providers (§8)
 */
class ProviderInterface {
    constructor(apiKey, model) {
        if (new.target === ProviderInterface) {
            throw new TypeError("Cannot instantiate abstract class ProviderInterface directly.");
        }
        this.apiKey = apiKey;
        this.model = model;
    }

    /**
     * Generate text completion from AI provider
     * @param {object} params - { systemPrompt, userPrompt, maxTokens, temperature }
     * @returns {Promise<string>} Raw text output
     */
    async generate({ systemPrompt, userPrompt, maxTokens = 4096, temperature = 0.2 }) {
        throw new Error("Method 'generate()' must be implemented by subclass.");
    }
}

module.exports = { ProviderInterface };
