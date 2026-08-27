const path = require("path");
const chalk = require("chalk");
const inquirer = require("inquirer");
const { parseAST } = require("../analysis/astParser");
const { extractExports } = require("../analysis/exportExtractor");
const { detectFramework } = require("../analysis/frameworkDetector");
const { buildContext } = require("../analysis/contextBuilder");
const { buildGroundedPrompt } = require("./promptBuilder");
const { validateGeneratedCode } = require("./validateOutput");
const { getDeterministicTestPath, writeTestFile } = require("./writeTestFile");
const { runTests } = require("../runner/runTests");
const { getProvider } = require("../providers");

async function generateTest({ file, config = {} }) {
    const projectRoot = config.projectRoot || process.cwd();
    const fileName = path.basename(file);
    const autoYes = config.yes === true;

    console.log(chalk.bold.cyan(`\n  ⚙ Generating test for ${fileName}...`));

    // 1. AST Analysis
    const astResult = parseAST(file);
    const extractedData = extractExports(astResult);
    const frameworkInfo = detectFramework(projectRoot);

    if (extractedData.exports.length === 0 && extractedData.jsxElements.length === 0) {
        console.log(chalk.yellow(`  ⚠ Skipping ${fileName}: No testable exports or JSX elements found.`));
        return { file, status: "skipped", reason: "no exports" };
    }

    // 2. Context Building — Level 1 + Level 2 + Level 3
    const contextPackage = buildContext(astResult, extractedData, projectRoot);
    if (contextPackage.level2.length > 0) {
        console.log(chalk.dim(`  📦 Context: ${contextPackage.level2.length} direct dep(s) included.`));
    }
    if (astResult.routeMetadata?.urlRoute) {
        console.log(chalk.dim(`  🗺  Route: ${astResult.routeMetadata.urlRoute}${astResult.routeMetadata.routeGroup ? ` (group: ${astResult.routeMetadata.routeGroup})` : ""}`));
    }

    // 3. Prompt Building
    const provider = getProvider(config.provider, config.apiKey, config.model);
    const { systemPrompt, userPrompt } = buildGroundedPrompt(astResult, extractedData, frameworkInfo, {
        testRunner: config.testRunner,
        projectRoot,
        outputDir: config.outputDir,
        contextPackage
    });

    // 4. AI Generation
    const rawOutput = await provider.generate({ systemPrompt, userPrompt });

    // 5. Validation — syntax + hallucination + quality gate + security
    let validated = validateGeneratedCode(rawOutput, extractedData);

    if (!validated.isValid) {
        console.log(chalk.yellow(`  ⚠ Validation retry: ${validated.error}`));
        const retryPrompt = `${userPrompt}\n\nYour previous output had errors: ${validated.error}.\nFix them and output ONLY complete, valid test code.`;
        const retryOutput = await provider.generate({ systemPrompt, userPrompt: retryPrompt });
        validated = validateGeneratedCode(retryOutput, extractedData);
        if (!validated.isValid) {
            throw new Error(`Failed to generate valid test file for ${fileName}: ${validated.error}`);
        }
    }

    // 6. Quality + Security warnings
    if (validated.qualityWarnings && validated.qualityWarnings.length > 0) {
        validated.qualityWarnings.forEach(w => {
            const isSecurity = w.startsWith("SECURITY:");
            console.log(isSecurity ? chalk.red(`  🚫 ${w}`) : chalk.yellow(`  ⚠ ${w}`));
        });

        // Hard-block SECURITY issues — never write file
        const hasSecurityBlock = validated.qualityWarnings.some(w => w.startsWith("SECURITY:"));
        if (hasSecurityBlock) {
            console.log(chalk.red(`  ❌ ${fileName} BLOCKED — security issue detected. File not written.`));
            return { file, status: "blocked", reason: "security", warnings: validated.qualityWarnings };
        }
    }

    // 7. User approval before writing to disk (spec §User Approval)
    const outputPath = getDeterministicTestPath(file, config.outputDir, projectRoot);
    const relOutput = path.relative(projectRoot, outputPath);

    if (!autoYes) {
        console.log(chalk.cyan(`\n  📄 Ready to write: ${relOutput}`));
        const { confirmed } = await inquirer.prompt([{
            type: "confirm",
            name: "confirmed",
            message: `  Write this test file?`,
            default: true
        }]);
        if (!confirmed) {
            console.log(chalk.dim(`  Skipped writing ${relOutput}.`));
            return { file, status: "skipped", reason: "user declined" };
        }
    }

    writeTestFile(outputPath, validated.code);
    console.log(chalk.bold.green(`  ✓ Wrote test file: ${relOutput}`));

    // 8. Optional verification (only if --verify flag explicitly passed)
    if (config.verify === true) {
        console.log(chalk.dim(`  🧪 Verifying test execution...`));
        const runResult = await runTests(outputPath, { projectRoot, testRunner: config.testRunner });
        if (runResult.passed) {
            console.log(chalk.green(`  ✅ Test execution PASSED.`));
        } else {
            console.log(chalk.yellow(`  ⚠ Test execution failed verification.`));
            console.log(chalk.dim((runResult.error || "").slice(0, 500)));
        }
        return { file, status: runResult.passed ? "passed" : "failed", outputPath };
    }

    return { file, status: "generated", outputPath };
}

module.exports = {
    generateTest
};
