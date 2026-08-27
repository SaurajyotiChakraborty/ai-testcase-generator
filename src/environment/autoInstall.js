const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const chalk = require("chalk");
const inquirer = require("inquirer");
const { detectPackageManager } = require("./detectTestRunner");
const { ensureGlobalJestEnvironment } = require("./jestEnvironmentManager");

async function autoInstallDependencies(projectRoot, missingDeps, options = {}) {
    if (!missingDeps || missingDeps.length === 0) return true;

    const autoYes = options.yes === true;
    console.log(chalk.yellow(`\n  ⚠ Missing test dependencies detected:`));
    missingDeps.forEach(d => console.log(chalk.dim(`    - ${d}`)));

    let confirm = autoYes;
    if (!autoYes) {
        const answer = await inquirer.prompt([
            {
                type: "confirm",
                name: "install",
                message: `Would you like to auto-install missing dependencies?`,
                default: true
            }
        ]);
        confirm = answer.install;
    }

    if (!confirm) {
        console.log(chalk.dim(`  Skipping dependency installation.`));
        return false;
    }

    const pm = detectPackageManager(projectRoot);
    const installCmd = pm === "yarn" ? `yarn add -D ${missingDeps.join(" ")}` :
                       pm === "pnpm" ? `pnpm add -D ${missingDeps.join(" ")}` :
                       `npm install -D ${missingDeps.join(" ")}`;

    console.log(chalk.cyan(`\n  Installing missing dependencies using ${pm}...`));
    try {
        execSync(installCmd, { cwd: projectRoot, stdio: "inherit" });
        console.log(chalk.green(`  ✓ Dependencies installed successfully.`));
        return true;
    } catch (e) {
        console.error(chalk.red(`  ❌ Failed to install dependencies: ${e.message}`));
        return false;
    }
}

/**
 * Ensures the test environment configuration is valid for the detected test runner.
 * - Jest: sets up jest.setup.js + setupFilesAfterEnv + moduleNameMapper
 * - Vitest: creates minimal vitest.config.ts if missing
 * - Mocha: creates minimal .mocharc.json if missing
 */
function ensureMinimalRunnerConfig(projectRoot, testRunner, frameworkInfo) {
    if (testRunner === "jest") {
        ensureGlobalJestEnvironment(projectRoot, frameworkInfo);

    } else if (testRunner === "vitest") {
        const hasVitestConfig = fs.readdirSync(projectRoot).some(f => f.startsWith("vitest.config."));
        if (!hasVitestConfig) {
            const vitestConfigPath = path.join(projectRoot, "vitest.config.ts");
            const isReact = frameworkInfo.isReact;
            let content;
            if (isReact) {
                content = `import { defineConfig } from 'vitest/config';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n  test: {\n    environment: 'jsdom',\n    globals: true,\n    setupFiles: ['./vitest.setup.ts'],\n  },\n});\n`;
                // Also create vitest.setup.ts if missing
                const setupPath = path.join(projectRoot, "vitest.setup.ts");
                if (!fs.existsSync(setupPath)) {
                    fs.writeFileSync(setupPath, `import '@testing-library/jest-dom';\n`, "utf8");
                    console.log(chalk.green(`  ✓ Created vitest.setup.ts with @testing-library/jest-dom`));
                }
            } else {
                content = `import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({\n  test: {\n    environment: 'node',\n    globals: true,\n  },\n});\n`;
            }
            fs.writeFileSync(vitestConfigPath, content, "utf8");
            console.log(chalk.green(`  ✓ Created vitest.config.ts`));
        }

    } else if (testRunner === "mocha") {
        const hasMochaConfig =
            fs.existsSync(path.join(projectRoot, ".mocharc.js")) ||
            fs.existsSync(path.join(projectRoot, ".mocharc.cjs")) ||
            fs.existsSync(path.join(projectRoot, ".mocharc.yaml")) ||
            fs.existsSync(path.join(projectRoot, ".mocharc.yml")) ||
            fs.existsSync(path.join(projectRoot, ".mocharc.json"));

        if (!hasMochaConfig) {
            const mochaConfig = {
                spec: "generated-tests/**/*.test.{js,jsx,ts,tsx}",
                require: frameworkInfo.isTypescript ? ["ts-node/register"] : [],
                timeout: 5000
            };
            fs.writeFileSync(
                path.join(projectRoot, ".mocharc.json"),
                JSON.stringify(mochaConfig, null, 2),
                "utf8"
            );
            console.log(chalk.green(`  ✓ Created .mocharc.json`));
        }
    }
}

module.exports = {
    autoInstallDependencies,
    ensureMinimalRunnerConfig
};
