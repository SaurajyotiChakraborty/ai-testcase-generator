const { ProviderInterface } = require("./ProviderInterface");

class OpenAIProvider extends ProviderInterface {
    constructor(apiKey, model = "gpt-4o") {
        super(apiKey, model);
    }

    async generate({ systemPrompt, userPrompt, maxTokens = 4096, temperature = 0.2 }) {
        let OpenAI;
        try {
            OpenAI = require("openai");
        } catch (e) {
            throw new Error(`The openai package is required for OpenAI provider. Please install it using: npm install openai`);
        }

        const client = new OpenAI({ apiKey: this.apiKey });
        try {
            const response = await client.chat.completions.create({
                model: this.model,
                temperature,
                max_tokens: maxTokens,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
            });
            return response.choices[0]?.message?.content || "";
        } catch (error) {
            if (error.status === 401) throw new Error("OpenAI Auth Error: Invalid API key provided.");
            if (error.status === 429) throw new Error("OpenAI Rate Limit Exceeded: Please check your account quota.");
            throw new Error(`OpenAI API Error (${error.status || "network"}): ${error.message}`);
        }
    }
}

module.exports = { OpenAIProvider };
