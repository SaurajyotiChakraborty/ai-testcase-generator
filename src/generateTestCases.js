const fs = require("fs");
const path = require("path");

const { getAIClient } = require("./gemini");

const {
    scanFolder
} = require("./fileScanner");

const {
    getFileAnalysis
} = require("./getFileAnalysis");

const {
    buildPrompt,
    buildPromptV2
} = require("./promptBuilder");

const {
    writeTestFile
} = require("./writeTestFile");

const {
    runWithLimit
} = require("./concurrency");

const {
    loadCache,
    isFileChanged,
    updateFileHash,
    saveCache
} = require("./cacheManager");

// Internal tool files that should not have tests generated for them.
// Uses exact basename matching instead of substring includes().
const internalFiles = [
    "parser.js",
    "functionRegistry.js",
    "exportRegistry.js",
    "dependencyGraph.js",
    "importParser.js",
    "exportParser.js",
    "fileScanner.js",
    "promptBuilder.js",
    "generateTestCases.js",
    "generatePrompt.js",
    "gemini.js",
    "getFileAnalysis.js",
    "readAnalysis.js",
    "writeTestFile.js",
    "testPrompt.js",
    "testScanner.js",
    "cfgBuilder.js",
    "dataFlowAnalyzer.js",
    "complexityAnalyzer.js",
    "frameworkDetector.js",
    "cli.js",
    "configLoader.js",
    "concurrency.js",
    "cacheManager.js"
];

async function generateTestCases(options = {}) {
    const targetPath = options.targetPath || "./src";
    const framework = options.framework || "jest";
    const model = options.model || "gemini-3.6-flash";
    const outputDir = options.outputDir || "./generated-tests";
    const ignore = options.ignore || [];
    const verbose = options.verbose !== false;
    const concurrency = options.concurrency || 3;
    const noCache = options.noCache === true;
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;

    let ai;
    try {
        ai = getAIClient(apiKey);
    } catch (e) {
        console.error(e.message);
        return;
    }

    function log(...args) {
        if (verbose) console.log(...args);
    }

    if (!noCache) {
        loadCache(targetPath);
    }

    const files = scanFolder(targetPath, ignore);

    // Create an array of tasks for concurrent execution
    const tasks = [];

    for (const file of files) {
        const fileName = path.basename(file);

        // Skip test files and internal tool files
        if (
            fileName.includes(".test.") ||
            internalFiles.includes(fileName)
        ) {
            continue;
        }

        const analysis = getFileAnalysis(fileName);

        if (!analysis || analysis.length === 0) {
            log(`Skipping ${fileName} (No functions found)`);
            continue;
        }

        // Check cache
        const testFileName = fileName.replace(path.extname(fileName), ".test.js");
        const outputPath = path.join(outputDir, testFileName);

        if (!noCache && fs.existsSync(outputPath) && !isFileChanged(file)) {
            log(`⏭️  Skipping ${fileName} (Unchanged / Cached)`);
            continue;
        }

        // Add generation task to the queue
        tasks.push(async () => {
            log(`\nGenerating tests for ${fileName}...`);

            try {
                // We will accumulate test code for all functions in the file
                let fullTestCode = `// AI-Generated Tests for ${fileName}\n// Framework: ${framework}\n\n`;

                for (const funcAnalysis of analysis) {
                    log(`  -> Generating tests for function: ${funcAnalysis.name}`);

                    const prompt = buildPromptV2(funcAnalysis, { framework });

                    const response = await ai.models.generateContent({
                        model: model,
                        contents: prompt
                    });

                    const cleaned = (response.text || "")
                        .replace(/```javascript/g, "")
                        .replace(/```js/g, "")
                        .replace(/```/g, "")
                        .trim();

                    fullTestCode += cleaned + "\n\n";
                }

                writeTestFile(fullTestCode, fileName);

                if (!noCache) {
                    updateFileHash(file);
                }

                log(`✅ ${fileName} completed`);

            } catch (error) {
                log(`❌ Failed to generate tests for ${fileName}`);
                log(error.message);
            }
        });
    }

    if (tasks.length > 0) {
        log(`\nStarting generation for ${tasks.length} file(s) with concurrency limit of ${concurrency}...`);
        await runWithLimit(tasks, concurrency);
    } else {
        log(`\nNo files require test generation.`);
    }

    if (!noCache) {
        saveCache();
    }

    log("\n🎉 Finished generating all test files.");
}

if (require.main === module) {
    generateTestCases();
}

module.exports = {
    generateTestCases
};