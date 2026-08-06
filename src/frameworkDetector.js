const fs = require('fs');
const path = require('path');

/**
 * Detects the testing framework used in the target project.
 * Checks package.json dependencies and common configuration files.
 * @param {string} targetPath The path to the target project
 * @returns {string} The detected framework ("jest", "vitest", "mocha", "jasmine", or default "jest")
 */
function detectFramework(targetPath) {
    const defaultFramework = "jest";
    try {
        const packageJsonPath = path.join(targetPath, 'package.json');
        
        // 1. Check package.json dependencies
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            const deps = { 
                ...(packageJson.dependencies || {}), 
                ...(packageJson.devDependencies || {}) 
            };

            if (deps['jest'] || deps['@jest/core']) return "jest";
            if (deps['vitest']) return "vitest";
            if (deps['mocha']) return "mocha";
            if (deps['jasmine'] || deps['jasmine-core']) return "jasmine";
        }

        // 2. Check for config files
        const configFiles = fs.readdirSync(targetPath);
        
        for (const file of configFiles) {
            if (file.startsWith('jest.config.')) return "jest";
            if (file.startsWith('vitest.config.')) return "vitest";
            if (file.startsWith('.mocharc.') || file === 'mocha.opts') return "mocha";
            if (file === 'jasmine.json') return "jasmine";
        }
        
    } catch (e) {
        // Silently fall back to default if project can't be read
    }

    return defaultFramework;
}

module.exports = {
    detectFramework
};
