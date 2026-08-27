const { ProviderInterface } = require("./ProviderInterface");

class ClaudeProvider extends ProviderInterface {
    constructor(apiKey, model = "claude-3-5-sonnet-20241022") {
        super(apiKey, model);
    }

    async generate({ systemPrompt, userPrompt, maxTokens = 4096, temperature = 0.2 }) {
        let Anthropic;
        try {
            Anthropic = require("@anthropic-ai/sdk").Anthropic || require("@anthropic-ai/sdk");
        } catch (e) {
            throw new Error(`The @anthropic-ai/sdk package is required for Claude provider. Please install it using: npm install @anthropic-ai/sdk`);
        }

        const client = new Anthropic({ apiKey: this.apiKey });
        try {
            const response = await client.messages.create({
                model: this.model,
                max_tokens: maxTokens,
                temperature,
                system: systemPrompt,
                messages: [{ role: "user", content: userPrompt }]
            });
            return response.content[0]?.text || "";
        } catch (error) {
            if (error.status === 401) throw new Error("Claude Auth Error: Invalid API key provided.");
            if (error.status === 429) throw new Error("Claude Rate Limit Exceeded: Please check your quota or retry after a pause.");
            throw new Error(`Claude API Error (${error.status || "network"}): ${error.message}`);
        }
    }
}

module.exports = { ClaudeProvider };
