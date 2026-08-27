const { loadConfig } = require("./config/loadConfig");
const { getProvider } = require("./providers");
const { discoverFiles } = require("./analysis/fileDiscovery");
const { parseAST, extractRouteMetadata } = require("./analysis/astParser");
const { detectFramework } = require("./analysis/frameworkDetector");
const { extractExports } = require("./analysis/exportExtractor");
const { resolvePathAliases } = require("./analysis/aliasResolver");
const { buildContext } = require("./analysis/contextBuilder");
const { detectTestRunner } = require("./environment/detectTestRunner");
const { ensureGlobalJestEnvironment } = require("./environment/jestEnvironmentManager");
const { generateTest } = require("./generation/generateTest");
const { runTests } = require("./runner/runTests");

/**
 * Programmatic Node.js API for codecase-ai
 */
async function generateTestCasesForProject(options = {}) {
    const config = await loadConfig(options);
    const files = discoverFiles(config.targetPath, config.ignore);
    const results = [];

    for (const file of files) {
        const testResult = await generateTest({ file, config });
        results.push(testResult);
    }

    return results;
}

module.exports = {
    generateTestCasesForProject,
    loadConfig,
    getProvider,
    discoverFiles,
    parseAST,
    extractRouteMetadata,
    detectFramework,
    extractExports,
    resolvePathAliases,
    buildContext,
    detectTestRunner,
    ensureGlobalJestEnvironment,
    generateTest,
    runTests
};
