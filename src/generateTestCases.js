const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const { generateWithAI } = require("./aiProvider");
const { scanFolder } = require("./fileScanner");
const { getFileAnalysis } = require("./getFileAnalysis");
const { buildPrompt, buildPromptV2 } = require("./promptBuilder");
const { writeTestFile } = require("./writeTestFile");
const { runWithLimit } = require("./concurrency");
const { runParser } = require("./parser");
const { filterTestable } = require("./smartFunctionSelector");
const { extractCodeBlock } = require("./responseCleaner");
const { scanForSecrets } = require("./securityScanner");
const { validateSyntax } = require("./syntaxValidator");
const { ensureJestBabelConfig, findProjectRoot } = require("./testRunnerConfig");

const {
    loadCache,
    isFileChanged,
    updateFileHash,
    saveCache
} = require("./cacheManager");

async function generateTestCases(options = {}) {
    const targetPath = options.targetPath || "./src";
    const framework = options.framework || "jest";
    const isReact = options.isReact || false;
    const isNextJs = options.isNextJs || false;
    const provider = options.provider || "gemini";
    const model = options.model;
    const outputDir = options.outputDir || "./generated-tests";
    const ignore = options.ignore || [];
    const verbose = options.verbose !== false;
    const concurrency = options.concurrency || 3;
    const noCache = options.noCache === true;
    const allMode = options.allMode === true;   // --all flag: generate for entire project
    const apiKey = options.apiKey
        || process.env.GEMINI_API_KEY
        || process.env.OPENAI_API_KEY
        || process.env.ANTHROPIC_API_KEY;

    function log(...args) {
        if (verbose) console.log(...args);
    }

    // ── Determine if targetPath is a single file or a directory ───────────
    // Must be done BEFORE loadCache to avoid writing cache inside a file path.
    const SINGLE_FILE_EXTS = [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"];
    const targetStat = fs.existsSync(targetPath) ? fs.statSync(targetPath) : null;
    const isSingleFile = (targetStat && targetStat.isFile()) ||
        (!targetStat && SINGLE_FILE_EXTS.includes(path.extname(targetPath)));

    // When target is a file, cache lives in its parent directory
    const cacheDir = isSingleFile ? path.dirname(path.resolve(targetPath)) : targetPath;

    if (!noCache) {
        loadCache(cacheDir);
    }

    // ── In single-file mode, re-run the parser for just that file ────────
    // This ensures analysis.json is always fresh for the file being tested
    if (isSingleFile) {
        log(chalk.cyan(`\n  📂 Single-file mode: analyzing ${path.basename(targetPath)}...`));
        runParser(targetPath, false, ignore);
    } else if (allMode) {
        log(chalk.cyan(`\n  📂 Project-wide mode (--all): analyzing entire ${targetPath}...`));
        runParser(targetPath, false, ignore);
    }
    // If neither single-file nor --all, we expect analysis.json from a prior run or from cli.js

    const files = scanFolder(targetPath, ignore);

    let tsAliases = [];
    let baseUrl = ".";
    const globalProjectRoot = (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) 
        ? findProjectRoot(path.dirname(targetPath)) 
        : findProjectRoot(targetPath);

    if (globalProjectRoot) {
        const tsconfigPath = path.join(globalProjectRoot, "tsconfig.json");
        if (fs.existsSync(tsconfigPath)) {
            try {
                const configContent = fs.readFileSync(tsconfigPath, "utf8");
                const cleanContent = configContent.split('\n').map(line => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('//')) return '';
                    return line;
                }).join('\n');
                const config = JSON.parse(cleanContent);
                baseUrl = config.compilerOptions?.baseUrl || ".";
                const paths = config.compilerOptions?.paths || {};
                for (const key in paths) {
                    tsAliases.push({
                        alias: key.replace(/\*/g, ""),
                        prefix: paths[key][0].replace(/\*/g, "")
                    });
                }
            } catch (e) {}
        }
    }

    const tasks = [];

    for (const file of files) {
        const fileName = path.basename(file);

        // Skip test files
        if (fileName.includes(".test.") || fileName.includes(".spec.")) {
            continue;
        }

        // Load raw analysis for this file
        let rawAnalysis = getFileAnalysis(fileName);

        if (!rawAnalysis || rawAnalysis.length === 0) {
            console.log(chalk.dim(`  ⏭️  Skipping ${fileName} — no functions found.`));
            continue;
        }

        // ── Smart function selection ─────────────────────────────────────────
        log(chalk.bold(`\n  🔍 Analyzing functions in ${chalk.white(fileName)}...`));
        const analysis = filterTestable(rawAnalysis, { verbose });

        if (analysis.length === 0) {
            console.log(chalk.yellow(`  ⚠  No testable functions found in ${fileName}. Skipping.`));
            continue;
        }

        // ── Cache check ──────────────────────────────────────────────────────
        const ext = path.extname(file);
        
        let relativeToRoot = file;
        if (globalProjectRoot) {
            relativeToRoot = path.relative(globalProjectRoot, path.resolve(file));
        } else {
            relativeToRoot = path.basename(file); // Fallback to flat if no root
        }
        
        // Avoid ".." escaping outputDir if targetPath is outside project root
        if (relativeToRoot.startsWith("..")) {
            relativeToRoot = path.basename(file);
        }

        const testRelativePath = relativeToRoot.replace(new RegExp(`\\${ext}$`), `.test${ext}`);
        const outputPath = path.join(outputDir, testRelativePath);
        const testDirAbs = path.dirname(path.resolve(outputPath));

        if (!noCache && fs.existsSync(outputPath) && !isFileChanged(file)) {
            console.log(chalk.dim(`  ⏭️  Skipping ${fileName} (Unchanged / Cached)`));
            continue;
        }

        // ── Calculate relative import path ───────────────────────────────────
        const sourceFileAbs = path.resolve(file);
        let relativeImport = path.relative(testDirAbs, sourceFileAbs).replace(/\\/g, "/");
        if (!relativeImport.startsWith(".")) {
            relativeImport = "./" + relativeImport;
        }
        let relativeImportNoExt = relativeImport.replace(/\.(js|ts|jsx|tsx|py|mjs|cjs)$/, "");
        
        // ── Alias resolution (prefer TS aliases over fragile relative paths) ─
        if (globalProjectRoot && tsAliases.length > 0) {
            let relToRoot = path.relative(globalProjectRoot, sourceFileAbs).replace(/\\/g, "/");
            if (!relToRoot.startsWith(".")) relToRoot = "./" + relToRoot;
            
            // Strip baseUrl prefix if present
            let effectiveRel = relToRoot;
            if (baseUrl !== "." && baseUrl !== "./") {
                let basePrefix = baseUrl;
                if (!basePrefix.startsWith("./")) basePrefix = "./" + basePrefix;
                if (effectiveRel.startsWith(basePrefix + "/")) {
                    effectiveRel = "./" + effectiveRel.substring(basePrefix.length + 1);
                }
            }

            for (const { alias, prefix } of tsAliases) {
                if (effectiveRel.startsWith(prefix)) {
                    let aliasedPath = alias + effectiveRel.substring(prefix.length);
                    relativeImportNoExt = aliasedPath.replace(/\.(js|ts|jsx|tsx|py|mjs|cjs)$/, "");
                    break;
                }
            }
        }

        const relativeDir = path.dirname(relativeImport);

        // ── Prepare dependencies with correct mock paths ─────────────────────
        const preparedAnalysis = analysis.map(func => ({
            ...func,
            dependencies: (func.dependencies || []).map(dep => {
                let mockPath = dep.sourceFile;
                if (mockPath.startsWith(".")) {
                    const depAbs = path.resolve(path.dirname(sourceFileAbs), dep.sourceFile);
                    let depRel = path.relative(testDirAbs, depAbs).replace(/\\/g, "/");
                    if (!depRel.startsWith(".")) depRel = "./" + depRel;
                    mockPath = depRel;
                }
                return { ...dep, mockPath };
            })
        }));

        // ── Queue the generation task ─────────────────────────────────────────
        tasks.push(async () => {
            console.log(chalk.bold.cyan(`\n  ⚙  Generating tests for ${fileName}...`));

            try {
                let fullTestCode = `// AI-Generated Tests for ${fileName}\n// Framework: ${framework}\n// Provider: ${provider}\n\n`;

                for (const funcAnalysis of preparedAnalysis) {
                    log(chalk.dim(`    → ${funcAnalysis.name}`));

                    let prompt = buildPromptV2(funcAnalysis, {
                        framework,
                        isReact,
                        isNextJs,
                        ext,
                        relativeImport: relativeImportNoExt
                    });

                    let retries = 0;
                    const MAX_RETRIES = 2;
                    let success = false;
                    let lastErrorMsg = "";

                    while (retries <= MAX_RETRIES && !success) {
                        try {
                            const responseText = await generateWithAI(prompt, {
                                provider,
                                apiKey,
                                model,
                                ext
                            });

                            let cleaned = extractCodeBlock(responseText, ext);

                            // Scan for secrets
                            scanForSecrets(cleaned);

                            // Validate syntax
                            const validation = validateSyntax(cleaned, ext);
                            if (!validation.isValid) {
                                throw new Error(validation.error);
                            }

                            // If valid, post-process imports
                            cleaned = cleaned.replace(
                                /require\(['"]\.\/([^'"]*)['"]\)/g,
                                `require('${relativeDir}/$1')`
                            );
                            cleaned = cleaned.replace(
                                /from\s+['"]\.\/([^'"]*)['"]/g,
                                `from '${relativeDir}/$1'`
                            );
                            cleaned = cleaned.replace(
                                /import\s+['"]\.\/([^'"]*)['"]/g,
                                `import '${relativeDir}/$1'`
                            );
                            cleaned = cleaned.replace(
                                /mock\(['"]\.\/([^'"]*)['"]\)/g,
                                `mock('${relativeDir}/$1')`
                            );
                            
                            if (fullTestCode) {
                                fullTestCode += cleaned + "\n\n";
                            }
                            
                            success = true;

                        } catch (genErr) {
                            retries++;
                            lastErrorMsg = genErr.message;
                            if (retries <= MAX_RETRIES) {
                                log(chalk.yellow(`      ⚠ Validation failed: ${lastErrorMsg}. Retrying (${retries}/${MAX_RETRIES})...`));
                                prompt += `\n\n> NOTE: Your previous generation failed with error: ${lastErrorMsg}\nPlease fix the issue and regenerate ONLY the raw code.`;
                            } else {
                                log(chalk.red(`      ❌ Failed after ${MAX_RETRIES} retries. Reason: ${lastErrorMsg}`));
                                // We throw to skip writing a broken file, or we can just skip this function.
                                throw new Error(`Function ${funcAnalysis.name} failed: ${lastErrorMsg}`);
                            }
                        }
                    }
                }

                writeTestFile(fullTestCode, testRelativePath, outputDir);

                if (!noCache) {
                    updateFileHash(file);
                }

                console.log(chalk.green(`  ✅ ${fileName} — done`));

            } catch (error) {
                console.error(chalk.red(`  ❌ Failed to generate tests for ${fileName}`));
                console.error(chalk.dim(`     ${error.message}`));
            }
        });
    }

    if (tasks.length > 0) {
        if (framework === "jest") {
            const targetDirForConfig = isSingleFile ? path.dirname(path.resolve(targetPath)) : targetPath;
            ensureJestBabelConfig(targetDirForConfig);
        }

        console.log(chalk.bold(`\n  Starting generation for ${chalk.cyan(tasks.length + " file(s)")} with concurrency ${concurrency}...`));
        console.log(chalk.dim(`  Provider: ${provider} | Model: ${model || "(default)"}\n`));
        await runWithLimit(tasks, concurrency);
    } else {
        console.log(chalk.yellow("\n  No files require test generation."));
    }

    if (!noCache) {
        saveCache();
    }

    console.log(chalk.bgGreen.black.bold("\n  🎉 Finished generating all test files.\n"));
}

if (require.main === module) {
    generateTestCases();
}

module.exports = {
    generateTestCases
};