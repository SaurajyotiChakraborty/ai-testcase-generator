const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const inquirer = require("inquirer");
const { detectFramework } = require("../analysis/frameworkDetector");
const { detectTestRunner } = require("../environment/detectTestRunner");
const { getRequiredDependencies, checkMissingDependencies } = require("../environment/dependencyChecker");
const { autoInstallDependencies, ensureMinimalRunnerConfig } = require("../environment/autoInstall");

const API_KEY_URLS = {
    gemini: "https://aistudio.google.com/app/apikey",
    openai: "https://platform.openai.com/api-keys",
    claude: "https://console.anthropic.com/settings/keys"
};

async function promptForConfig(options = {}) {
    const projectRoot = process.cwd();
    const frameworkInfo = detectFramework(projectRoot);
    const defaultRunner = detectTestRunner(projectRoot, frameworkInfo).runner;

    console.log(chalk.bold.cyan("\n  🤖 Welcome to codecase-ai Setup Wizard!"));

    const providerAnswer = await inquirer.prompt([
        {
            type: "list",
            name: "provider",
            message: "Select your AI provider:",
            choices: [
                { name: "Google Gemini (gemini-3.6-flash)", value: "gemini" },
                { name: "OpenAI (GPT-4o)", value: "openai" },
                { name: "Claude (Claude 3.5 Sonnet)", value: "claude" }
            ],
            default: "gemini"
        }
    ]);

    const selectedProvider = providerAnswer.provider;
    const keyUrl = API_KEY_URLS[selectedProvider] || API_KEY_URLS.gemini;

    console.log(chalk.dim(`\n  🔑 Need an API Key? Get one here: `) + chalk.underline.cyan(keyUrl));

    const remainingAnswers = await inquirer.prompt([
        {
            type: "password",
            name: "apiKey",
            message: `Enter your ${selectedProvider.toUpperCase()} API Key (press Enter to use environment variable):`,
            mask: "*"
        },
        {
            type: "list",
            name: "scope",
            message: "Select test generation scope:",
            choices: [
                { name: "Full project (src/ or app/)", value: "full" },
                { name: "Single file or path", value: "single" }
            ],
            default: "full"
        },
        {
            type: "input",
            name: "singlePath",
            message: "Enter single file or path to test:",
            when: (ans) => ans.scope === "single",
            validate: (input) => fs.existsSync(path.resolve(input)) || "Path does not exist!"
        }
    ]);

    const answers = { ...providerAnswer, ...remainingAnswers };

    // Handle API Key security (§3)
    if (answers.apiKey) {
        const envLocalPath = path.join(projectRoot, ".env.local");
        const keyEnvVar = `${answers.provider.toUpperCase()}_API_KEY=${answers.apiKey}\n`;
        fs.appendFileSync(envLocalPath, keyEnvVar, "utf8");

        const gitIgnorePath = path.join(projectRoot, ".gitignore");
        if (fs.existsSync(gitIgnorePath)) {
            const gitIgnore = fs.readFileSync(gitIgnorePath, "utf8");
            if (!gitIgnore.includes(".env.local")) {
                fs.appendFileSync(gitIgnorePath, "\n.env.local\n", "utf8");
            }
        }
    }

    const testRunner = defaultRunner;
    const reqDeps = getRequiredDependencies(frameworkInfo, testRunner, frameworkInfo.isTypescript);
    const missing = checkMissingDependencies(projectRoot, reqDeps);

    if (missing.length > 0) {
        console.log(chalk.cyan(`\n  Detected Framework: ${frameworkInfo.isNextJs ? "Next.js" : "React/JS"}`));
        console.log(chalk.cyan(`  Detected Test Runner: ${testRunner}`));
        await autoInstallDependencies(projectRoot, missing, { yes: options.yes });
    }
    ensureMinimalRunnerConfig(projectRoot, testRunner, frameworkInfo);

    const config = {
        provider: answers.provider,
        testRunner,
        targetPath: answers.scope === "single" ? answers.singlePath : (frameworkInfo.isNextJs && fs.existsSync(path.join(projectRoot, "app")) ? "./app" : "./src"),
        outputDir: "generated-tests",
        concurrency: 3,
        ignore: []
    };

    const rcPath = path.join(projectRoot, ".aitestgenrc.json");
    fs.writeFileSync(rcPath, JSON.stringify(config, null, 2), "utf8");

    return config;
}

module.exports = {
    promptForConfig
};
