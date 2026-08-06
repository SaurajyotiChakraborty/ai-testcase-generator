const fs = require('fs');
const path = require('path');

/**
 * Loads the aitest.config.js or aitest.config.json file if present.
 * @param {string} targetPath The directory to look for the config file.
 * @returns {object} The merged configuration object.
 */
function loadConfig(targetPath) {

    // Default configuration
    const defaultConfig = {
        target: "./src",
        output: "generated-tests",
        framework: "auto",
        provider: "gemini",
        model: "",
        apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || "",
        ignore: [],
        testTypes: ["positive", "negative", "edge", "exception"],
        concurrency: 3
    };

    let userConfig = {};

    try {
        const jsConfigPath = path.join(targetPath, 'aitest.config.js');
        const jsonConfigPath = path.join(targetPath, 'aitest.config.json');

        if (fs.existsSync(jsConfigPath)) {
            userConfig = require(path.resolve(jsConfigPath));
        } else if (fs.existsSync(jsonConfigPath)) {
            userConfig = JSON.parse(fs.readFileSync(jsonConfigPath, 'utf-8'));
        }
    } catch (error) {
        console.warn(`\n⚠️ Warning: Found a configuration file but failed to load it: ${error.message}`);
    }

    // Merge default and user configs
    return { ...defaultConfig, ...userConfig };
}

module.exports = {
    loadConfig
};
