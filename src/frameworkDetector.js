const fs = require('fs');
const path = require('path');

/**
 * Detects the testing framework used in the target project.
 * Checks package.json dependencies and common configuration files.
 * @param {string} targetPath The path to the target project
 * @returns {object} { framework: string, isReact: boolean, isNextJs: boolean }
 */
function detectFramework(targetPath) {
    const result = {
        framework: "jest",
        isReact: false,
        isNextJs: false
    };

    try {
        const packageJsonPath = path.join(targetPath, 'package.json');
        
        // 1. Check package.json dependencies
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            const deps = { 
                ...(packageJson.dependencies || {}), 
                ...(packageJson.devDependencies || {}) 
            };

            if (deps['vitest']) result.framework = "vitest";
            else if (deps['mocha']) result.framework = "mocha";
            else if (deps['jasmine'] || deps['jasmine-core']) result.framework = "jasmine";
            else if (deps['jest'] || deps['@jest/core']) result.framework = "jest";

            if (deps['react'] || deps['@testing-library/react']) result.isReact = true;
            if (deps['next']) result.isNextJs = true;
        }

        // 2. Check for config files if framework is still default
        if (result.framework === "jest") {
            const configFiles = fs.readdirSync(targetPath);
            
            for (const file of configFiles) {
                if (file.startsWith('vitest.config.')) { result.framework = "vitest"; break; }
                if (file.startsWith('.mocharc.') || file === 'mocha.opts') { result.framework = "mocha"; break; }
                if (file === 'jasmine.json') { result.framework = "jasmine"; break; }
                if (file.startsWith('jest.config.')) { result.framework = "jest"; break; }
            }
        }
    } catch (e) {
        // Silently fall back to default if project can't be read
    }

    return result;
}

module.exports = {
    detectFramework
};
