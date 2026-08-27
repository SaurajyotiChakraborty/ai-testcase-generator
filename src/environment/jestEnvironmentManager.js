const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { resolvePathAliases } = require("../analysis/aliasResolver");

/**
 * Global Jest Environment & Setup Manager (§10, Rules 1, 2, 8, 9)
 *
 * Ensures:
 * 1. @testing-library/jest-dom is imported in the project's global setup file.
 * 2. The global setup file is properly referenced in setupFilesAfterEnv in Jest config.
 * 3. Module aliases (@/*) from tsconfig/jsconfig are configured in Jest's moduleNameMapper.
 * 4. Existing project setup files and Jest configs are safely updated without overwriting.
 */

const SETUP_FILE_CANDIDATES = [
    "jest.setup.js",
    "jest.setup.ts",
    "jest.setup.mjs",
    "jest.setup.cjs",
    "setupTests.js",
    "setupTests.ts",
    "setupTests.jsx",
    "setupTests.tsx",
    "src/setupTests.js",
    "src/setupTests.ts",
    "src/jest.setup.js",
    "src/jest.setup.ts"
];

function findExistingSetupFile(projectRoot) {
    for (const candidate of SETUP_FILE_CANDIDATES) {
        const fullPath = path.join(projectRoot, candidate);
        if (fs.existsSync(fullPath)) {
            return { fullPath, relativePath: candidate };
        }
    }
    return null;
}

function ensureJestDomInSetupFile(setupFilePath) {
    if (!fs.existsSync(setupFilePath)) return false;

    const content = fs.readFileSync(setupFilePath, "utf8");
    const hasJestDom = content.includes("@testing-library/jest-dom") || content.includes("jest-dom/extend-expect");

    if (!hasJestDom) {
        const importLine = "import '@testing-library/jest-dom';\n";
        const updated = importLine + content;
        fs.writeFileSync(setupFilePath, updated, "utf8");
        return true; // updated
    }
    return false; // already present
}

function ensureGlobalJestEnvironment(projectRoot, frameworkInfo = {}) {
    const { jestModuleNameMapper } = resolvePathAliases(projectRoot);

    // 1. Locate or create setup file (Rule 1)
    let setupInfo = findExistingSetupFile(projectRoot);
    let setupPath;
    let setupRel;

    if (setupInfo) {
        setupPath = setupInfo.fullPath;
        setupRel = setupInfo.relativePath.replace(/\\/g, "/");
        const wasUpdated = ensureJestDomInSetupFile(setupPath);
        if (wasUpdated) {
            console.log(chalk.green(`  ✓ Added import '@testing-library/jest-dom' to existing setup file: ${setupRel}`));
        }
    } else {
        // Create jest.setup.js
        setupRel = "jest.setup.js";
        setupPath = path.join(projectRoot, setupRel);
        const setupContent = `import '@testing-library/jest-dom';\n`;
        fs.writeFileSync(setupPath, setupContent, "utf8");
        console.log(chalk.green(`  ✓ Created global Jest setup file: ${setupRel}`));
    }

    // 2. Inspect & configure Jest configuration file (Rule 2)
    const configCandidates = [
        "jest.config.js",
        "jest.config.ts",
        "jest.config.mjs",
        "jest.config.cjs"
    ];

    let foundJestConfig = null;
    for (const cand of configCandidates) {
        const candPath = path.join(projectRoot, cand);
        if (fs.existsSync(candPath)) {
            foundJestConfig = { fullPath: candPath, filename: cand };
            break;
        }
    }

    // Check package.json for "jest" key
    const pkgPath = path.join(projectRoot, "package.json");
    let pkgHasJestConfig = false;
    if (!foundJestConfig && fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            if (pkg.jest && typeof pkg.jest === "object") {
                pkgHasJestConfig = true;
            }
        } catch (e) {}
    }

    const expectedSetupEntry = `<rootDir>/${setupRel}`;

    if (foundJestConfig) {
        // Inspect existing jest config file
        try {
            let content = fs.readFileSync(foundJestConfig.fullPath, "utf8");
            let modified = false;

            // Ensure setupFilesAfterEnv exists in file
            if (!content.includes("setupFilesAfterEnv")) {
                if (content.includes("module.exports =")) {
                    content = content.replace(
                        /module\.exports\s*=\s*\{/,
                        `module.exports = {\n  setupFilesAfterEnv: ['${expectedSetupEntry}'],`
                    );
                    modified = true;
                } else if (content.includes("export default")) {
                    content = content.replace(
                        /export default\s*\{/,
                        `export default {\n  setupFilesAfterEnv: ['${expectedSetupEntry}'],`
                    );
                    modified = true;
                } else if (content.includes("customJestConfig = {")) {
                    content = content.replace(
                        /customJestConfig\s*=\s*\{/,
                        `customJestConfig = {\n  setupFilesAfterEnv: ['${expectedSetupEntry}'],`
                    );
                    modified = true;
                }
            } else if (!content.includes(setupRel) && !content.includes(expectedSetupEntry)) {
                // Add to setupFilesAfterEnv array if missing
                content = content.replace(
                    /setupFilesAfterEnv\s*:\s*\[/,
                    `setupFilesAfterEnv: ['${expectedSetupEntry}', `
                );
                modified = true;
            }

            // Ensure moduleNameMapper is present if aliases exist
            if (Object.keys(jestModuleNameMapper).length > 0 && !content.includes("moduleNameMapper")) {
                const mapperString = JSON.stringify(jestModuleNameMapper, null, 4).replace(/^/gm, "  ");
                if (content.includes("module.exports = {")) {
                    content = content.replace(
                        /module\.exports\s*=\s*\{/,
                        `module.exports = {\n  moduleNameMapper: ${mapperString},`
                    );
                    modified = true;
                } else if (content.includes("customJestConfig = {")) {
                    content = content.replace(
                        /customJestConfig\s*=\s*\{/,
                        `customJestConfig = {\n  moduleNameMapper: ${mapperString},`
                    );
                    modified = true;
                }
            }

            if (modified) {
                fs.writeFileSync(foundJestConfig.fullPath, content, "utf8");
                console.log(chalk.green(`  ✓ Updated existing Jest config: ${foundJestConfig.filename}`));
            }
        } catch (e) {
            // Could not parse/update safely, preserve existing file
        }
    } else if (pkgHasJestConfig) {
        // Update package.json "jest" object
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            pkg.jest = pkg.jest || {};
            let modified = false;

            if (!Array.isArray(pkg.jest.setupFilesAfterEnv)) {
                pkg.jest.setupFilesAfterEnv = [expectedSetupEntry];
                modified = true;
            } else if (!pkg.jest.setupFilesAfterEnv.some(s => s.includes(setupRel))) {
                pkg.jest.setupFilesAfterEnv.push(expectedSetupEntry);
                modified = true;
            }

            if (!pkg.jest.moduleNameMapper && Object.keys(jestModuleNameMapper).length > 0) {
                pkg.jest.moduleNameMapper = jestModuleNameMapper;
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
                console.log(chalk.green(`  ✓ Updated Jest configuration in package.json`));
            }
        } catch (e) {}
    } else {
        // Create new jest.config.js
        const configPath = path.join(projectRoot, "jest.config.js");
        let newConfigContent = "";

        const srcExists = fs.existsSync(path.join(projectRoot, "src"));
        const defaultMapper = Object.keys(jestModuleNameMapper).length > 0
            ? jestModuleNameMapper
            : { "^@/(.*)$": srcExists ? "<rootDir>/src/$1" : "<rootDir>/$1" };

        if (frameworkInfo.isNextJs) {
            newConfigContent = `const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/${setupRel}'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: ${JSON.stringify(defaultMapper, null, 4)}
};

module.exports = createJestConfig(customJestConfig);
`;
        } else {
            newConfigContent = `module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/${setupRel}'],
  moduleNameMapper: ${JSON.stringify(defaultMapper, null, 4)}
};
`;
        }

        fs.writeFileSync(configPath, newConfigContent, "utf8");
        console.log(chalk.green(`  ✓ Created global jest.config.js`));
    }
}

module.exports = {
    ensureGlobalJestEnvironment,
    findExistingSetupFile,
    ensureJestDomInSetupFile
};
