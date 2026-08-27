const fs = require("fs");
const path = require("path");
const { Command } = require("commander");
const chalk = require("chalk");
const inquirer = require("inquirer");
const { detectFramework } = require("../analysis/frameworkDetector");
const { detectTestRunner } = require("../environment/detectTestRunner");
const { getRequiredDependencies, checkMissingDependencies } = require("../environment/dependencyChecker");
const { autoInstallDependencies, ensureMinimalRunnerConfig } = require("../environment/autoInstall");
const { promptForConfig } = require("./promptForConfig");
const { discoverFiles } = require("../analysis/fileDiscovery");
const { generateTest } = require("../generation/generateTest");
const { runWithLimit } = require("../concurrency");

function findProjectRoot(startDir = process.cwd()) {
    let curr = path.resolve(startDir);
    while (curr) {
        if (fs.existsSync(path.join(curr, "package.json"))) return curr;
        const parent = path.dirname(curr);
        if (parent === curr) break;
        curr = parent;
    }
    return process.cwd();
}

async function loadConfig(options = {}) {
    const projectRoot = options.projectRoot || findProjectRoot(options.targetPath || process.cwd());
    const rcPath = path.join(projectRoot, ".aitestgenrc.json");

    let rcConfig = {};
    if (fs.existsSync(rcPath)) {
        try {
            rcConfig = JSON.parse(fs.readFileSync(rcPath, "utf8"));
        } catch (e) {}
    }

    const provider = options.provider || rcConfig.provider || process.env.AI_PROVIDER || "gemini";
    const apiKey = options.apiKey 
        || rcConfig.apiKey 
        || process.env[`${provider.toUpperCase()}_API_KEY`]
        || process.env.GEMINI_API_KEY 
        || process.env.OPENAI_API_KEY 
        || process.env.ANTHROPIC_API_KEY;

    const frameworkInfo = detectFramework(projectRoot);
    const runnerDetection = (options.framework || rcConfig.testRunner)
        ? { runner: options.framework || rcConfig.testRunner, conflicts: [], signals: [] }
        : detectTestRunner(projectRoot, frameworkInfo);

    // Warn about conflicting test runner signals
    if (runnerDetection.conflicts && runnerDetection.conflicts.length > 0) {
        const chalk = require("chalk");
        runnerDetection.conflicts.forEach(c =>
            console.log(chalk.yellow(`  ⚠ Conflict: ${c}`))
        );
        console.log(chalk.dim(`  Using: ${runnerDetection.runner} (highest confidence)`));
    }
    const testRunner = runnerDetection.runner;

    return {
        projectRoot,
        provider,
        apiKey,
        frameworkInfo,
        testRunner,
        outputDir: options.output || rcConfig.outputDir || "generated-tests",
        concurrency: options.concurrency || rcConfig.concurrency || 1,
        targetPath: options.path || options.targetPath || rcConfig.targetPath || "./src",
        ignore: options.ignore || rcConfig.ignore || [],
        yes: options.yes === true
    };
}

async function executeRun(targetPath, config) {
    // 1. Environment & Dependency Check (§4)
    const reqDeps = getRequiredDependencies(config.frameworkInfo, config.testRunner, config.frameworkInfo.isTypescript);
    const missing = checkMissingDependencies(config.projectRoot, reqDeps);
    
    if (missing.length > 0) {
        await autoInstallDependencies(config.projectRoot, missing, { yes: config.yes });
    }
    ensureMinimalRunnerConfig(config.projectRoot, config.testRunner, config.frameworkInfo);

    // 2. Discover Files (§10)
    const files = discoverFiles(targetPath, config.ignore);
    console.log(chalk.bold.cyan(`\n  🔍 Discovered ${files.length} file(s) for test generation.`));

    // 3. Bounded Concurrency Processing (§10)
    const tasks = files.map(file => async () => {
        try {
            return await generateTest({ file, config });
        } catch (err) {
            console.error(chalk.red(`  ❌ Error processing ${path.basename(file)}: ${err.message}`));
            return { file, status: "failed", error: err.message };
        }
    });

    const results = await runWithLimit(tasks, config.concurrency);
    
    const generated = results.filter(r => r.status === "generated" || r.status === "passed").length;
    const skipped = results.filter(r => r.status === "skipped").length;

    console.log(chalk.bold.green(`\n  🎉 Test Case Generation Complete: ${generated} test file(s) generated into '${config.outputDir}' directory | ${skipped} skipped`));
}

async function runCLI(argv) {
    const program = new Command();
    program
        .name("codecase-ai")
        .description("AI Test Case Generator (npm package)")
        .version(require("../../package.json").version);

    program
        .command("init")
        .description("Interactively setup AI test generator configuration (.aitestgenrc.json)")
        .option("-y, --yes", "Automatically accept default options and dependency installation")
        .action(async (opts) => {
            const config = await promptForConfig(opts);
            console.log(chalk.bold.green(`\n  ✓ Configuration saved to .aitestgenrc.json`));

            const answer = await inquirer.prompt([
                {
                    type: "confirm",
                    name: "startRun",
                    message: "Would you like to run test generation now?",
                    default: true
                }
            ]);

            if (answer.startRun) {
                console.log(chalk.cyan(`\n  🚀 Starting test generation...`));
                const fullConfig = await loadConfig({ ...opts, targetPath: config.targetPath });
                await executeRun(config.targetPath, fullConfig);
            } else {
                console.log(chalk.yellow(`\n  Setup complete! Whenever you are ready to generate tests, run:`));
                console.log(chalk.bold.cyan(`  npx codecase-ai run\n`));
            }
        });

    program
        .command("run [path]")
        .description("Generate unit test cases using AI")
        .option("-p, --provider <name>", "AI provider (gemini, openai, claude)")
        .option("-k, --api-key <key>", "API key for the selected AI provider (prefer .env.local)")
        .option("-f, --framework <name>", "Test runner (jest, vitest, mocha) — auto-detected if omitted")
        .option("-o, --output <dir>", "Output directory for test files", "generated-tests")
        .option("-c, --concurrency <number>", "Number of files to process at once", parseInt, 1)
        .option("-y, --yes", "Skip confirmation prompts")
        .option("--path <fileOrDir>", "File or directory path to generate tests for")
        .action(async (cliPath, opts) => {
            const config = await loadConfig(opts);
            const targetPath = cliPath || opts.path || config.targetPath;

            // ── API key safety: never display the key value ──────────────────
            if (opts.apiKey) {
                console.log(chalk.dim("  🔑 API key: provided via flag (masked)"));
            } else if (config.apiKey) {
                console.log(chalk.dim("  🔑 API key: loaded from .env / .env.local"));
            } else {
                console.log(chalk.red("  ❌ No API key found."));
                console.log(chalk.yellow("  Add it to your project's .env.local file:"));
                console.log(chalk.dim("    GEMINI_API_KEY=your_key_here"));
                console.log(chalk.dim("    OPENAI_API_KEY=your_key_here"));
                console.log(chalk.dim("    ANTHROPIC_API_KEY=your_key_here"));
                console.log(chalk.yellow("  Or run: npx codecase-ai init\n"));
                process.exit(1);
            }

            // ── Framework selection: prompt if not given ──────────────────────
            if (!config.testRunner || config.testRunner === "jest") {
                // Check if it was explicitly given via --framework or saved config
                const wasExplicit = opts.framework || ((() => {
                    const rcPath = require('path').join(config.projectRoot, '.aitestgenrc.json');
                    if (fs.existsSync(rcPath)) {
                        try { return JSON.parse(fs.readFileSync(rcPath, 'utf8')).testRunner; } catch(e) {}
                    }
                    return null;
                })());

                if (!wasExplicit && !opts.yes) {
                    const detected = config.testRunner || 'jest';
                    const { chosenRunner } = await inquirer.prompt([{
                        type: 'list',
                        name: 'chosenRunner',
                        message: `  Select test framework (auto-detected: ${detected}):`,
                        choices: [
                            { name: `Jest       — use Jest${detected === 'jest' ? ' (auto-detected)' : ''}`, value: 'jest' },
                            { name: `Vitest     — use Vitest${detected === 'vitest' ? ' (auto-detected)' : ''}`, value: 'vitest' },
                            { name: `Mocha      — use Mocha + Chai${detected === 'mocha' ? ' (auto-detected)' : ''}`, value: 'mocha' }
                        ],
                        default: detected
                    }]);
                    config.testRunner = chosenRunner;
                }
            }

            console.log(chalk.bold.cyan(`\n  🤖 codecase-ai v${require('../../package.json').version}`));
            console.log(chalk.dim(`  Provider : ${config.provider}  |  Runner: ${config.testRunner}  |  Output: ${config.outputDir}\n`));

            await executeRun(targetPath, config);
        });

    program.parse(argv);
}

module.exports = {
    loadConfig,
    runCLI,
    findProjectRoot
};
