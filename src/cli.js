#!/usr/bin/env node

const { Command } = require('commander');
const { runParser } = require('./parser');
const { generateTestCases } = require('./generateTestCases');
const { detectFramework } = require('./frameworkDetector');
const { loadConfig } = require('./configLoader');
const { getDefaultModel } = require('./aiProvider');

require("dotenv").config();

const program = new Command();

program
    .name('ai-testcase-generator')
    .description('Automatically generate unit tests using AI (Gemini, OpenAI, Claude)')
    .version('1.0.0')
    .argument('[path]', 'Target directory or file to analyze', './src')
    .option('-p, --provider <name>', 'AI provider (gemini, openai, anthropic)', 'gemini')
    .option('-f, --framework <name>', 'Testing framework (jest, vitest, mocha, jasmine, auto)', 'auto')
    .option('-o, --output <dir>', 'Output directory', 'generated-tests')
    .option('-m, --model <name>', 'AI model to use (auto-selects best for provider)')
    .option('-k, --api-key <key>', 'API Key for the selected provider')
    .option('-a, --analyze-only', 'Run analysis only, do not generate tests')
    .option('-i, --ignore <paths...>', 'Additional folders/files to ignore')
    .option('-c, --concurrency <number>', 'Number of concurrent files to process', parseInt)
    .option('--no-cache', 'Disable incremental caching and force regeneration')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (targetPathArg, options) => {

        const verbose = !!options.verbose;

        function log(...args) {
            if (verbose) console.log(...args);
        }

        // Load configuration file if present
        const detectPath = targetPathArg === './src' ? '.' : targetPathArg;
        const config = loadConfig(detectPath);

        // Merge CLI options over Config options
        const targetPath = targetPathArg !== './src' ? targetPathArg : config.target;
        const ignore = options.ignore ? options.ignore : config.ignore;
        let framework = options.framework !== 'auto' ? options.framework : config.framework;
        const outputDir = options.output !== 'generated-tests' ? options.output : config.output;
        const provider = options.provider !== 'gemini' ? options.provider : config.provider;
        const model = options.model ? options.model : config.model;
        const apiKey = options.apiKey ? options.apiKey : config.apiKey;
        const concurrency = options.concurrency !== undefined ? options.concurrency : config.concurrency;
        const noCache = options.cache === false;

        console.log(`\n🚀 Starting AI Test Case Generator...`);
        console.log(`Target path: ${targetPath}`);
        console.log(`AI Provider: ${provider} | Model: ${model || getDefaultModel(provider)}`);

        if (framework === 'auto') {
            console.log(`Auto-detecting framework...`);
            const fwDetectPath = targetPath === './src' ? '.' : targetPath;
            framework = detectFramework(fwDetectPath);
            console.log(`Detected framework: ${framework}`);
        } else {
            console.log(`Selected framework: ${framework}`);
        }

        console.log(`\n--- Phase 1: Analyzing Source Code ---`);

        // Run analysis
        runParser(targetPath, verbose, ignore);

        if (options.analyzeOnly) {
            console.log(`\n✅ Analysis complete. Exiting (--analyze-only).`);
            return;
        }

        console.log(`\n--- Phase 2: Generating Tests ---`);

        await generateTestCases({
            targetPath: targetPath,
            framework: framework,
            provider: provider,
            model: model,
            apiKey: apiKey,
            outputDir: outputDir,
            ignore: ignore,
            verbose: verbose,
            concurrency: concurrency,
            noCache: noCache
        });

    });

program.parse();
