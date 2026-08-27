const chalk = require("chalk");
const { validateGeneratedCode } = require("../generation/validateOutput");
const { writeTestFile } = require("../generation/writeTestFile");
const { runTests } = require("./runTests");

/**
 * Trim error output to the most relevant ~2000 chars to avoid wasting AI tokens.
 * Extracts the first failure block + stack trace.
 */
function trimError(errorStr) {
    if (!errorStr || typeof errorStr !== "string") return "Unknown test error";
    
    // Remove ANSI color codes
    const clean = errorStr.replace(/\x1B\[[0-9;]*m/g, "");
    
    if (clean.length <= 2000) return clean;

    // Try to find the first FAIL block or Error line
    const failIdx = clean.indexOf("FAIL ");
    const errIdx = clean.indexOf("Error:");
    const startIdx = Math.min(
        failIdx >= 0 ? failIdx : clean.length,
        errIdx >= 0 ? errIdx : clean.length
    );

    const relevant = clean.substring(startIdx, startIdx + 2000);
    return relevant + "\n... (error trimmed to save tokens)";
}

async function selfHealTest({ provider, initialCode, initialError, outputPath, projectRoot, testRunner, astResult, extractedData, frameworkInfo, maxRetries = 3 }) {
    let currentCode = initialCode;
    let currentError = trimError(initialError);
    let attempt = 0;

    while (attempt < maxRetries) {
        attempt++;
        console.log(chalk.yellow(`  🔄 Self-Healing (Attempt ${attempt}/${maxRetries}): Fixing test failure...`));

        const healPrompt = `The unit test code you generated failed during execution. Fix it.

### Current Test Code
\`\`\`typescript
${currentCode}
\`\`\`

### Execution Error
\`\`\`
${currentError}
\`\`\`

### Fix Instructions
1. Read the error message carefully. Fix ONLY the specific error shown.
2. Common fixes:
   - "Cannot find module" → Fix the import path. Use relative paths, not @/ aliases.
   - "is not a function" / "Cannot read properties of undefined" → The hook or module is not mocked. Add jest.mock() for it.
   - "not wrapped in act" → Wrap the action in act() or use await waitFor().
   - "Unable to find role" / "Unable to find" → The element text/role doesn't match. Check the source code for exact text.
   - "window.location" errors → NEVER use window.location in JSDOM. Mock the router instead.
   - "Cannot find namespace 'jest'" → This is a TS types issue, not a real error. Ignore it.
3. Keep the same test structure. Only fix the broken parts.
4. Return ONLY the complete corrected executable test code. No markdown fences, no explanations.
`;

        try {
            const rawResponse = await provider.generate({
                systemPrompt: "You are an expert test engineer fixing broken unit tests. Return ONLY corrected code.",
                userPrompt: healPrompt,
                temperature: 0.1
            });

            const validated = validateGeneratedCode(rawResponse, extractedData);
            if (!validated.isValid) {
                console.log(chalk.dim(`  ⚠ Attempt ${attempt}: AST validation failed: ${validated.error}`));
                // Still try writing it — the "validation" might be overly strict
                if (validated.code && validated.code.length > 50) {
                    currentCode = validated.code;
                }
                continue;
            }

            // Write corrected code to disk
            writeTestFile(outputPath, validated.code);
            currentCode = validated.code;

            // Re-run test execution verification
            const runResult = await runTests(outputPath, { projectRoot, testRunner });
            if (runResult.passed) {
                console.log(chalk.green(`  ✅ Self-Healing PASSED on attempt ${attempt}/${maxRetries}!`));
                return { healed: true, code: validated.code, attempts: attempt };
            }

            console.log(chalk.dim(`  ⚠ Attempt ${attempt} tests still failing. Feeding new error to AI...`));
            currentError = trimError(runResult.error);

        } catch (e) {
            console.log(chalk.dim(`  ⚠ Attempt ${attempt} provider error: ${e.message}`));
        }
    }

    console.log(chalk.yellow(`  ⚠ Self-Healing reached limit (${maxRetries} attempts). Preserving best-effort code.`));
    return { healed: false, code: currentCode, attempts: maxRetries };
}

module.exports = {
    selfHealTest
};
