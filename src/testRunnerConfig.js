const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const chalk = require("chalk");

function findProjectRoot(currentDir) {
    let dir = path.resolve(currentDir);
    while (dir) {
        if (fs.existsSync(path.join(dir, "package.json"))) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return null;
}

function getModuleNameMapperFromTsConfig(projectRoot) {
    const tsconfigPath = path.join(projectRoot, "tsconfig.json");
    const jsconfigPath = path.join(projectRoot, "jsconfig.json");
    const configPath = fs.existsSync(tsconfigPath) ? tsconfigPath : (fs.existsSync(jsconfigPath) ? jsconfigPath : null);

    if (!configPath) return null;

    try {
        const configContent = fs.readFileSync(configPath, "utf8");
        const cleanContent = configContent.split('\n').map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//')) return '';
            return line;
        }).join('\n');
        const config = JSON.parse(cleanContent);

        if (config.compilerOptions && config.compilerOptions.paths) {
            const paths = config.compilerOptions.paths;
            const moduleNameMapper = {};

            const baseUrl = config.compilerOptions.baseUrl || ".";
            
            for (const key in paths) {
                const value = paths[key][0];
                
                // Escape special characters in the key before regex conversion (like parenthesis)
                const safeKey = key.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
                const mappedKey = "^" + safeKey.replace(/\\\*/g, "(.*)") + "$";
                
                let mappedValue = value.replace(/\*/g, "$1");
                // BaseURL relative resolution
                if (mappedValue.startsWith("./")) {
                    mappedValue = mappedValue.slice(2);
                }
                
                // If baseUrl is something like src, we prepend it
                let basePrefix = baseUrl !== "." && baseUrl !== "./" ? baseUrl + "/" : "";
                if (basePrefix.startsWith("./")) basePrefix = basePrefix.slice(2);
                
                mappedValue = "<rootDir>/" + basePrefix + mappedValue;
                
                moduleNameMapper[mappedKey] = mappedValue;
            }
            return moduleNameMapper;
        }
    } catch (e) {
        // Ignore JSON parsing errors
    }
    return null;
}

function ensureJestBabelConfig(targetDir) {
    const projectRoot = findProjectRoot(targetDir);
    if (!projectRoot) return;

    const packageJsonPath = path.join(projectRoot, "package.json");
    if (!fs.existsSync(packageJsonPath)) return;

    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Auto-install React Testing Library if it's a React project
    const isReact = !!(deps["react"] || deps["react-dom"] || deps["next"]);
    if (isReact) {
        const reactTestingPackages = [];
        if (!deps["@testing-library/react"]) reactTestingPackages.push("@testing-library/react");
        if (!deps["@testing-library/jest-dom"]) reactTestingPackages.push("@testing-library/jest-dom");
        
        if (reactTestingPackages.length > 0) {
            console.log(chalk.cyan(`  ⚙️  React detected. Installing testing libraries: ${reactTestingPackages.join(", ")}...`));
            try {
                execSync(`npm install -D ${reactTestingPackages.join(" ")}`, { cwd: projectRoot, stdio: "ignore" });
            } catch (e) {
                console.log(chalk.yellow(`  ⚠️  Failed to install React testing libraries.`));
            }
        }
    }

    // Parse TS aliases for moduleNameMapper
    const mapper = getModuleNameMapperFromTsConfig(projectRoot);
    let mapperStr = "";
    if (mapper && Object.keys(mapper).length > 0) {
        mapperStr = `\n  moduleNameMapper: ${JSON.stringify(mapper, null, 2).replace(/\n/g, '\n  ')},`;
    }

    // If it's a Next.js project, setup next/jest
    if (deps["next"]) {
        const jestConfigJsPath = path.join(projectRoot, "jest.config.js");
        const jestConfigMjsPath = path.join(projectRoot, "jest.config.mjs");
        const jestConfigTsPath = path.join(projectRoot, "jest.config.ts");

        if (!fs.existsSync(jestConfigJsPath) && !fs.existsSync(jestConfigMjsPath) && !fs.existsSync(jestConfigTsPath)) {
            console.log(chalk.cyan(`\n  ⚙️  Next.js detected. Creating minimal next/jest configuration...`));

            // Create jest.setup.js to globally register @testing-library/jest-dom matchers
            const jestSetupPath = path.join(projectRoot, "jest.setup.js");
            if (!fs.existsSync(jestSetupPath)) {
                fs.writeFileSync(jestSetupPath, `import '@testing-library/jest-dom';\n`, "utf8");
            }

            const nextJestConfig = `const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],${mapperStr}
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
`;
            fs.writeFileSync(jestConfigJsPath, nextJestConfig, "utf8");
            
            // Install jest-environment-jsdom if missing
            if (!deps["jest-environment-jsdom"]) {
                console.log(chalk.cyan(`  Installing jest-environment-jsdom...`));
                try {
                    execSync(`npm install -D jest-environment-jsdom`, { cwd: projectRoot, stdio: "ignore" });
                } catch (e) {
                    console.log(chalk.yellow(`  ⚠️  Failed to install jest-environment-jsdom.`));
                }
            }
        } else {
            // Config already exists — patch setupFilesAfterEnv into it if it's a JS config
            const jestSetupPath = path.join(projectRoot, "jest.setup.js");
            if (!fs.existsSync(jestSetupPath)) {
                fs.writeFileSync(jestSetupPath, `import '@testing-library/jest-dom';\n`, "utf8");
                console.log(chalk.green(`  ✔ Created jest.setup.js for @testing-library/jest-dom matchers.`));
                console.log(chalk.yellow(`  ℹ️  Add 'setupFilesAfterEnv: [\"<rootDir>/jest.setup.js\"]' to your jest.config.js if not already present.`));
            }
            if (mapperStr && fs.existsSync(jestConfigJsPath)) {
                const existingCfg = fs.readFileSync(jestConfigJsPath, "utf8");
                if (!existingCfg.includes("moduleNameMapper")) {
                    console.log(chalk.yellow(`  ℹ️  Add the following moduleNameMapper to your jest.config.js for path aliases:`));
                    console.log(chalk.dim(mapperStr));
                }
            }
        }
        return; // Next.js handles TSX/JSX compilation natively via SWC
    }

    // Standard Babel + React + TS setup
    const babelRcPath = path.join(projectRoot, ".babelrc");
    const babelConfigJsPath = path.join(projectRoot, "babel.config.js");
    const babelConfigJsonPath = path.join(projectRoot, "babel.config.json");

    const hasBabelConfig = fs.existsSync(babelRcPath) || fs.existsSync(babelConfigJsPath) || fs.existsSync(babelConfigJsonPath) || pkg.babel;

    if (!hasBabelConfig) {
        console.log(chalk.cyan(`\n  ⚙️  Creating minimal Babel configuration for Jest (JSX/TSX support)...`));
        const babelConfig = {
            presets: [
                ["@babel/preset-env", { targets: { node: "current" } }],
                "@babel/preset-typescript",
                ["@babel/preset-react", { runtime: "automatic" }]
            ]
        };
        fs.writeFileSync(babelRcPath, JSON.stringify(babelConfig, null, 2), "utf8");

        // Install missing Babel presets
        const packagesToInstall = [];
        if (!deps["@babel/preset-env"]) packagesToInstall.push("@babel/preset-env");
        if (!deps["@babel/preset-typescript"]) packagesToInstall.push("@babel/preset-typescript");
        if (!deps["@babel/preset-react"]) packagesToInstall.push("@babel/preset-react");
        
        if (packagesToInstall.length > 0) {
            console.log(chalk.cyan(`  Installing Babel dependencies: ${packagesToInstall.join(", ")}...`));
            try {
                execSync(`npm install -D ${packagesToInstall.join(" ")}`, { cwd: projectRoot, stdio: "ignore" });
            } catch (e) {
                console.log(chalk.yellow(`  ⚠️  Failed to install Babel dependencies.`));
            }
        }
    }

    // Ensure jest.config.js exists for standard projects to inject moduleNameMapper and jest.setup.js
    const jestConfigJsPath = path.join(projectRoot, "jest.config.js");
    const jestConfigMjsPath = path.join(projectRoot, "jest.config.mjs");
    const jestConfigTsPath = path.join(projectRoot, "jest.config.ts");

    if (!fs.existsSync(jestConfigJsPath) && !fs.existsSync(jestConfigMjsPath) && !fs.existsSync(jestConfigTsPath)) {
        console.log(chalk.cyan(`  ⚙️  Creating minimal jest.config.js...`));
        
        const jestSetupPath = path.join(projectRoot, "jest.setup.js");
        let setupStr = "";
        if (isReact) {
            if (!fs.existsSync(jestSetupPath)) {
                fs.writeFileSync(jestSetupPath, `import '@testing-library/jest-dom';\n`, "utf8");
            }
            setupStr = `\n  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],`;
            
            if (!deps["jest-environment-jsdom"]) {
                console.log(chalk.cyan(`  Installing jest-environment-jsdom...`));
                try {
                    execSync(`npm install -D jest-environment-jsdom`, { cwd: projectRoot, stdio: "ignore" });
                } catch (e) {}
            }
        }

        const jestConfig = `/** @type {import('jest').Config} */\nmodule.exports = {\n  testEnvironment: '${isReact ? 'jsdom' : 'node'}',${setupStr}${mapperStr}\n};\n`;
        fs.writeFileSync(jestConfigJsPath, jestConfig, "utf8");
    } else {
        if (mapperStr && fs.existsSync(jestConfigJsPath)) {
            const existingCfg = fs.readFileSync(jestConfigJsPath, "utf8");
            if (!existingCfg.includes("moduleNameMapper")) {
                console.log(chalk.yellow(`  ℹ️  Add the following moduleNameMapper to your jest.config.js for path aliases:`));
                console.log(chalk.dim(mapperStr));
            }
        }
    }
}

module.exports = {
    ensureJestBabelConfig,
    findProjectRoot,
    getModuleNameMapperFromTsConfig
};
