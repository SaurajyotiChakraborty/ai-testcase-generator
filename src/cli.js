#!/usr/bin/env node

const { Command } = require("commander");
const chalk = require("chalk");
const { runParser } = require("./parser");
const { generateTestCases } = require("./generateTestCases");
const { detectFramework } = require("./frameworkDetector");
const { loadConfig } = require("./configLoader");
const { getDefaultModel } = require("./aiProvider");
const { runSetupWizard } = require("./setupWizard");

require("dotenv").config();

const program = new Command();

program
    .name("codecase-ai")
    .description("Automatically generate unit tests using AI (Gemini, OpenAI, Claude)")
    .version(require('../package.json').version)
    .argument("[path]", "Target file or directory to generate tests for", "./src")
    .option("-p, --provider <name>", "AI provider (gemini, openai, anthropic)", "gemini")
    .option("-f, --framework <name>", "Testing framework (jest, vitest, mocha, jasmine, auto)", "auto")
    .option("-o, --output <dir>", "Output directory for generated test files", "generated-tests")
    .option("-m, --model <name>", "AI model to use (auto-selects best for provider)")
    .option("-k, --api-key <key>", "API Key for the selected provider")
    .option("-a, --analyze-only", "Run analysis only, skip test generation")
    .option("--all", "Generate tests for the entire project (directory mode). Without this, a file path runs single-file mode.")
    .option("-i, --ignore <paths...>", "Additional folders/files to ignore")
    .option("-c, --concurrency <number>", "Number of concurrent files to process", parseInt)
    .option("--no-cache", "Disable caching and force regeneration of all files")
    .option("-v, --verbose", "Enable verbose logging")
    .action(async (targetPathArg, options) => {

        const verbose = !!options.verbose;

        function log(...args) {
            if (verbose) console.log(...args);
        }

        // ── init / setup command ─────────────────────────────────────────────
        if (targetPathArg === "init" || targetPathArg === "setup") {
            const detectPath = ".";
            await runSetupWizard(detectPath);
            return;
        }

        // ── Load config file ─────────────────────────────────────────────────
        const config = loadConfig(".");

        // ── Resolve settings (CLI flags > config file > defaults) ────────────
        const targetPath = targetPathArg !== "./src" ? targetPathArg : (config.target || "./src");
        const ignore = options.ignore ? options.ignore : (config.ignore || []);
        let framework = options.framework !== "auto" ? options.framework : (config.framework || "auto");
        let apiKey = options.apiKey ? options.apiKey : config.apiKey;
        let provider = options.provider !== "gemini" ? options.provider : (config.provider || "gemini");

        // ── First-time setup if no API key found anywhere ────────────────────
        if (!apiKey) {
            console.log(chalk.yellow("\n  🔑 No API Key detected. Launching first-time setup...\n"));
            const setupConfig = await runSetupWizard(".");
            apiKey = setupConfig.apiKey;
            provider = setupConfig.provider;
            if (setupConfig.framework !== "auto") {
                framework = setupConfig.framework;
            }
        }

        const outputDir = options.output !== "generated-tests" ? options.output : (config.output || "generated-tests");
        const model = options.model ? options.model : config.model;
        const concurrency = options.concurrency !== undefined ? options.concurrency : (config.concurrency || 3);
        const noCache = options.cache === false;

        // ── Detect if running in single-file vs whole-project mode ───────────
        const fs = require("fs");
        const path = require("path");
        const SINGLE_FILE_EXTS = [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"];
        const targetStat = fs.existsSync(targetPath) ? fs.statSync(targetPath) : null;
        // Fallback: if fs.existsSync misses it (cwd mismatch), detect by extension
        const isSingleFile = (targetStat && targetStat.isFile()) ||
            (!targetStat && SINGLE_FILE_EXTS.includes(path.extname(targetPath)));
        const allMode = !!options.all;

        // ── Print startup banner ─────────────────────────────────────────────
        console.log("");
        console.log(chalk.bgCyan.black.bold("  🤖  codecase-ai  "));
        console.log("");

        if (isSingleFile) {
            console.log(chalk.bold("  Mode:     ") + chalk.cyan("Single File"));
            console.log(chalk.bold("  Target:   ") + chalk.white(targetPath));
        } else if (allMode) {
            console.log(chalk.bold("  Mode:     ") + chalk.cyan("Whole Project (--all)"));
            console.log(chalk.bold("  Target:   ") + chalk.white(targetPath));
        } else {
            console.log(chalk.bold("  Mode:     ") + chalk.cyan("Directory (default)"));
            console.log(chalk.bold("  Target:   ") + chalk.white(targetPath));
            console.log(chalk.dim("  Tip: use --all to scan the entire project"));
        }

        console.log(chalk.bold("  Provider: ") + chalk.white(provider) + chalk.dim(` | Model: ${model || getDefaultModel(provider)}`));

        // ── Framework detection ──────────────────────────────────────────────
        const fwDetectPath = isSingleFile ? "." : targetPath;
        const fwInfo = detectFramework(fwDetectPath);
        
        if (framework === "auto") {
            framework = fwInfo.framework;
            console.log(chalk.bold("  Framework:") + chalk.white(` ${framework} `) + chalk.dim("(auto-detected)"));
        } else {
            console.log(chalk.bold("  Framework:") + chalk.white(` ${framework}`));
        }

        const isReact = fwInfo.isReact;
        const isNextJs = fwInfo.isNextJs;

        console.log("");

        // ── Phase 1: Analysis ─────────────────────────────────────────────────
        // In single-file mode, generateTestCases will re-run the parser internally.
        // In directory/all mode, we run the parser here first.
        if (!isSingleFile) {
            console.log(chalk.bold.white("  ── Phase 1: Analyzing Source Code ──────────────────────"));
            runParser(targetPath, verbose, ignore);
        } else {
            console.log(chalk.bold.white("  ── Phase 1: Analyzing Source Code ──────────────────────"));
            // Single-file mode: generateTestCases re-runs the parser for that file
            log(chalk.dim("  (Single-file mode: will parse inline)"));
        }

        if (options.analyzeOnly) {
            console.log(chalk.green("\n  ✅ Analysis complete. Exiting (--analyze-only).\n"));
            return;
        }

        // ── Phase 2: Generate Tests ───────────────────────────────────────────
        console.log(chalk.bold.white("  ── Phase 2: Generating Tests ──────────────────────────"));

        await generateTestCases({
            targetPath,
            framework,
            isReact,
            isNextJs,
            provider,
            model,
            apiKey,
            outputDir,
            ignore,
            verbose,
            concurrency,
            noCache,
            allMode: isSingleFile ? false : allMode
        });
    });

program.parse();
