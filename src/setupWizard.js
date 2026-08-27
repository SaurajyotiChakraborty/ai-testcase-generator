const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const inquirer = require("inquirer");

// ─── Banner ─────────────────────────────────────────────────────────────────

function printBanner() {
    console.log("");
    console.log(chalk.bgCyan.black.bold("                                                    "));
    console.log(chalk.bgCyan.black.bold("   🤖  codecase-ai  ·  AI Unit Test Generator  🧪  "));
    console.log(chalk.bgCyan.black.bold("                                                    "));
    console.log("");
    console.log(chalk.cyan("  Welcome! Let's configure your AI test generator."));
    console.log(chalk.dim("  This creates an aitest.config.json in your project root."));
    console.log(chalk.dim("  You can re-run this anytime with: ") + chalk.yellow("npx codecase-ai init"));
    console.log("");
}

// ─── Provider helpers ────────────────────────────────────────────────────────

const PROVIDER_DETAILS = {
    gemini: {
        label: "Google Gemini",
        envKey: "GEMINI_API_KEY",
        keyHint: "Get yours at: https://aistudio.google.com/apikey",
        defaultModel: "gemini-3.6-flash"
    },
    openai: {
        label: "OpenAI (GPT-4o / GPT-4)",
        envKey: "OPENAI_API_KEY",
        keyHint: "Get yours at: https://platform.openai.com/api-keys",
        defaultModel: "gpt-4o"
    },
    anthropic: {
        label: "Anthropic (Claude 3.5)",
        envKey: "ANTHROPIC_API_KEY",
        keyHint: "Get yours at: https://console.anthropic.com/settings/keys",
        defaultModel: "claude-3-5-sonnet-20241022"
    }
};

// ─── Main Wizard ─────────────────────────────────────────────────────────────

/**
 * Runs the interactive setup wizard.
 * @param {string} targetDir Directory to write aitest.config.json to.
 * @returns {Promise<object>} The generated config object.
 */
async function runSetupWizard(targetDir = ".") {
    printBanner();

    // ── Step 1: Provider selection ──────────────────────────────────────────
    console.log(chalk.bold.white("  Step 1 of 3 — Choose your AI Provider"));
    console.log("");

    const { provider } = await inquirer.prompt([
        {
            type: "list",
            name: "provider",
            message: chalk.cyan("Which AI provider do you want to use?"),
            choices: [
                {
                    name: `${chalk.green("●")} Google Gemini   ${chalk.dim("(Free tier available)")}`,
                    value: "gemini",
                    short: "Google Gemini"
                },
                {
                    name: `${chalk.yellow("●")} OpenAI GPT-4o  ${chalk.dim("(Best code quality)")}`,
                    value: "openai",
                    short: "OpenAI"
                },
                {
                    name: `${chalk.magenta("●")} Anthropic Claude ${chalk.dim("(Great reasoning)")}`,
                    value: "anthropic",
                    short: "Anthropic Claude"
                }
            ],
            pageSize: 5
        }
    ]);

    const providerInfo = PROVIDER_DETAILS[provider];

    console.log("");
    console.log(chalk.green(`  ✔ Provider selected: ${chalk.bold(providerInfo.label)}`));
    console.log("");

    // ── Step 2: API Key ─────────────────────────────────────────────────────
    console.log(chalk.bold.white("  Step 2 of 3 — Enter your API Key"));
    console.log(chalk.dim(`  ${providerInfo.keyHint}`));
    console.log("");

    // Check if the env variable is already set
    const existingKey = process.env[providerInfo.envKey];
    let apiKey = "";

    if (existingKey) {
        console.log(chalk.green(`  ✔ Found existing ${providerInfo.envKey} environment variable.`));
        const { useExisting } = await inquirer.prompt([
            {
                type: "confirm",
                name: "useExisting",
                message: chalk.cyan(`Use the existing ${providerInfo.envKey} from your environment?`),
                default: true
            }
        ]);

        if (useExisting) {
            apiKey = existingKey;
        }
    }

    if (!apiKey) {
        const { enteredKey } = await inquirer.prompt([
            {
                type: "password",
                name: "enteredKey",
                message: chalk.cyan(`Enter your ${chalk.bold(providerInfo.label)} API Key:`),
                mask: "●",
                validate: (val) => {
                    if (!val || val.trim().length < 10) {
                        return chalk.red("Please enter a valid API key (at least 10 characters).");
                    }
                    return true;
                }
            }
        ]);
        apiKey = enteredKey.trim();
    }

    console.log("");
    if (!existingKey && apiKey) {
        // Save to .env securely
        const envPath = path.join(targetDir, ".env");
        const envLine = `${providerInfo.envKey}=${apiKey}\n`;
        try {
            fs.appendFileSync(envPath, envLine, "utf8");
            console.log(chalk.green(`  ✔ API Key saved to ${chalk.bold('.env')}`));
            
            // Also create .env.example
            const envExamplePath = path.join(targetDir, ".env.example");
            const envExampleLine = `${providerInfo.envKey}=your_${providerInfo.envKey.toLowerCase()}\n`;
            if (!fs.existsSync(envExamplePath) || !fs.readFileSync(envExamplePath, "utf8").includes(providerInfo.envKey)) {
                fs.appendFileSync(envExamplePath, envExampleLine, "utf8");
            }
            
            // Add .env to .gitignore
            const gitignorePath = path.join(targetDir, ".gitignore");
            if (fs.existsSync(gitignorePath)) {
                const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
                if (!gitignoreContent.includes(".env")) {
                    fs.appendFileSync(gitignorePath, "\n# Environment variables\n.env\n.env.local\n.env.*.local\n", "utf8");
                    console.log(chalk.green(`  ✔ Added .env to ${chalk.bold('.gitignore')}`));
                }
            } else {
                fs.writeFileSync(gitignorePath, "# Environment variables\n.env\n.env.local\n.env.*.local\n", "utf8");
            }
        } catch (e) {
            console.log(chalk.yellow(`  ⚠ Could not write to .env or .gitignore file.`));
        }
    } else {
        console.log(chalk.green("  ✔ API Key is configured via environment."));
    }
    console.log("");

    // ── Step 3: Test Framework ──────────────────────────────────────────────
    console.log(chalk.bold.white("  Step 3 of 3 — Choose your Test Framework"));
    console.log("");

    const { framework } = await inquirer.prompt([
        {
            type: "list",
            name: "framework",
            message: chalk.cyan("Which testing framework does your project use?"),
            choices: [
                {
                    name: `${chalk.cyan("◉")} Auto-detect  ${chalk.dim("(Recommended — reads your package.json)")}`,
                    value: "auto",
                    short: "Auto-detect"
                },
                {
                    name: `${chalk.blue("◉")} Jest         ${chalk.dim("(Most popular)")}`,
                    value: "jest",
                    short: "Jest"
                },
                {
                    name: `${chalk.yellow("◉")} Vitest       ${chalk.dim("(Vite-native)")}`,
                    value: "vitest",
                    short: "Vitest"
                },
                {
                    name: `${chalk.green("◉")} Mocha        ${chalk.dim("(Classic Node.js)")}`,
                    value: "mocha",
                    short: "Mocha"
                },
                {
                    name: `${chalk.magenta("◉")} Jasmine      ${chalk.dim("(BDD style)")}`,
                    value: "jasmine",
                    short: "Jasmine"
                }
            ],
            pageSize: 6
        }
    ]);

    console.log("");
    console.log(chalk.green(`  ✔ Framework: ${chalk.bold(framework)}`));
    console.log("");

    // ── Build and save config ───────────────────────────────────────────────
    const config = {
        target: "./src",
        output: "generated-tests",
        framework,
        provider,
        model: providerInfo.defaultModel,
        ignore: [],
        concurrency: 3
    };

    const configFilePath = path.join(targetDir, "aitest.config.json");

    try {
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 4), "utf8");

        console.log("");
        console.log(chalk.bgGreen.black.bold("  ✅  Setup Complete!  "));
        console.log("");
        console.log(chalk.white("  Configuration saved to: ") + chalk.yellow(configFilePath));
        console.log("");
        console.log(chalk.bold("  Quick start commands:"));
        console.log("  " + chalk.cyan("npx codecase-ai ./src") + chalk.dim("         — Generate tests for ./src"));
        console.log("  " + chalk.cyan("npx codecase-ai ./src/myFile.js") + chalk.dim("  — Generate tests for one file"));
        console.log("  " + chalk.cyan("npx codecase-ai ./src --all") + chalk.dim("    — Generate tests for entire project"));
        console.log("  " + chalk.cyan("npx codecase-ai init") + chalk.dim("           — Re-run this setup wizard"));
        console.log("");

    } catch (err) {
        console.log("");
        console.log(chalk.yellow(`  ⚠️  Could not write config file: ${err.message}`));
        console.log(chalk.dim("  You can create aitest.config.json manually."));
        console.log("");
    }

    return { ...config, apiKey };
}

module.exports = {
    runSetupWizard
};
