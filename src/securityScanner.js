const chalk = require("chalk");

/**
 * Scans generated code for potential secrets (API keys, tokens, etc.)
 * Throws an error if any are detected to prevent them from being saved to disk.
 *
 * @param {string} code - The generated code to scan.
 */
function scanForSecrets(code) {
    // Basic regexes for common API keys / secrets
    const secretPatterns = [
        /(?:AIza[0-9A-Za-z-_]{35})/g, // Google / Gemini API Key
        /(?:sk-[a-zA-Z0-9]{48})/g,    // OpenAI API Key
        /(?:sk-ant-[a-zA-Z0-9_-]{86})/g, // Anthropic API Key
        /(?:xox[pbo]-[a-zA-Z0-9]+-[a-zA-Z0-9]+)/g, // Slack Token
        /(?:gh[pousr]_[a-zA-Z0-9]{36})/g, // GitHub Token
        /(?:Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*)/g, // Generic Bearer Token
        /["']?[a-zA-Z0-9_-]*(?:api_?key|secret|token|password|credentials)["']?\s*[:=]\s*["'][a-zA-Z0-9\-\._~\+\/]{10,}["']/gi // Generic assignment of secrets
    ];

    for (const pattern of secretPatterns) {
        if (pattern.test(code)) {
            // Do NOT print the actual matched secret in the error
            throw new Error("Generated output contained a possible secret/API key and was rejected.");
        }
    }
}

module.exports = {
    scanForSecrets
};
