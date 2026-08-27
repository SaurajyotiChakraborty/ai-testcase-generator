const { spawn } = require("child_process");
const path = require("path");

/**
 * Runs a generated test file using the detected test runner.
 *
 * Returns a structured result object per spec §Error Reporting:
 * {
 *   passed: boolean,
 *   testFile: string,
 *   framework: string,
 *   testRunner: string,
 *   error: string | null,
 *   errorCategory: 'generation' | 'validation' | 'execution' | null,
 *   stdout: string,
 *   stderr: string,
 *   suggestedFix: string | null,
 *   timedOut: boolean
 * }
 */
function categorizeError(stderr, stdout) {
    const combined = (stderr + stdout).toLowerCase();

    if (combined.includes("cannot find module") || combined.includes("module not found")) {
        return {
            category: "execution",
            suggestion: "A module import is missing or the path is wrong. Check that the import path in the generated test matches your project's actual file structure and path aliases."
        };
    }
    if (combined.includes("syntaxerror") || combined.includes("unexpected token") || combined.includes("missing semicolon")) {
        return {
            category: "generation",
            suggestion: "The generated test has a syntax error. Re-run with a different AI model or report this file to the maintainer."
        };
    }
    if (combined.includes("tobeinthe") || combined.includes("jest-dom") || combined.includes("tobe is not a function")) {
        return {
            category: "execution",
            suggestion: "The @testing-library/jest-dom matchers are not loaded. Run `npx codecase-ai init` to repair the Jest setup file."
        };
    }
    if (combined.includes("timeout") || combined.includes("exceeded")) {
        return {
            category: "execution",
            suggestion: "A test timed out. Ensure all async operations, timers, and intervals are properly cleaned up in afterEach()."
        };
    }
    if (combined.includes("typeerror") && combined.includes("is not a function")) {
        return {
            category: "execution",
            suggestion: "A mocked function was called incorrectly. Check that jest.fn() / vi.fn() mocks are set up before the test runs."
        };
    }
    if (combined.includes("expect(received).")) {
        return {
            category: "execution",
            suggestion: "An assertion failed. Review the expected values in the test against the actual behavior of the source function."
        };
    }
    return {
        category: "execution",
        suggestion: "Check the error output above. Look for mismatched imports, missing mocks, or incorrect assertions."
    };
}

function runTests(testFilePath, options = {}) {
    const projectRoot = options.projectRoot || process.cwd();
    const testRunner = options.testRunner || "jest";
    const timeoutMs = options.timeoutMs || 45000;

    return new Promise((resolve) => {
        const args = testRunner === "vitest"
            ? ["vitest", "run", testFilePath, "--reporter=verbose"]
            : testRunner === "mocha"
            ? ["mocha", testFilePath, "--timeout", "10000"]
            : ["jest", testFilePath, "--forceExit", "--no-cache", "--verbose"];

        const proc = spawn("npx", args, {
            cwd: projectRoot,
            shell: true,
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, FORCE_COLOR: "0" }
        });

        let stdout = "";
        let stderr = "";
        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            proc.kill("SIGKILL");
        }, timeoutMs);

        proc.stdout.on("data", (d) => stdout += d.toString());
        proc.stderr.on("data", (d) => stderr += d.toString());

        proc.on("close", (code) => {
            clearTimeout(timer);

            if (timedOut) {
                resolve({
                    passed: false,
                    testFile: path.relative(projectRoot, testFilePath),
                    framework: options.framework || "unknown",
                    testRunner,
                    error: `Test execution timed out after ${timeoutMs / 1000}s.`,
                    errorCategory: "execution",
                    suggestedFix: "Ensure all timers, intervals, and async operations are properly cleaned up in afterEach().",
                    stdout,
                    stderr,
                    timedOut: true
                });
                return;
            }

            if (code === 0) {
                resolve({
                    passed: true,
                    testFile: path.relative(projectRoot, testFilePath),
                    framework: options.framework || "unknown",
                    testRunner,
                    error: null,
                    errorCategory: null,
                    suggestedFix: null,
                    stdout,
                    stderr,
                    timedOut: false
                });
            } else {
                const { category, suggestion } = categorizeError(stderr, stdout);
                resolve({
                    passed: false,
                    testFile: path.relative(projectRoot, testFilePath),
                    framework: options.framework || "unknown",
                    testRunner,
                    error: stderr || stdout,
                    errorCategory: category,
                    suggestedFix: suggestion,
                    stdout,
                    stderr,
                    timedOut: false
                });
            }
        });

        proc.on("error", (err) => {
            clearTimeout(timer);
            resolve({
                passed: false,
                testFile: path.relative(projectRoot, testFilePath),
                framework: options.framework || "unknown",
                testRunner,
                error: `Failed to spawn test runner '${testRunner}': ${err.message}`,
                errorCategory: "execution",
                suggestedFix: `Make sure '${testRunner}' is installed. Run: npm install -D ${testRunner}`,
                stdout,
                stderr,
                timedOut: false
            });
        });
    });
}

module.exports = {
    runTests
};
