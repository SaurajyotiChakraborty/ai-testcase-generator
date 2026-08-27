const fs = require("fs");
const path = require("path");

/**
 * Dynamically resolves tsconfig.json / jsconfig.json path aliases (e.g. @/* -> ./src/*)
 * and builds corresponding Jest moduleNameMapper entries.
 * 
 * Rule 9: Dynamic alias detection without hardcoding project names or routes.
 */
function parseJsonc(content) {
    // Strip single-line and multi-line comments from JSONC
    const clean = content
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*/g, "");
    return JSON.parse(clean);
}

function resolvePathAliases(projectRoot) {
    let baseUrl = ".";
    let paths = {};
    let foundConfig = false;

    // Check tsconfig.json first, then jsconfig.json
    const configCandidates = ["tsconfig.json", "jsconfig.json"];
    for (const file of configCandidates) {
        const fullPath = path.join(projectRoot, file);
        if (fs.existsSync(fullPath)) {
            try {
                const content = fs.readFileSync(fullPath, "utf8");
                const parsed = parseJsonc(content);
                const opts = parsed.compilerOptions || {};
                baseUrl = opts.baseUrl || ".";
                if (opts.paths && Object.keys(opts.paths).length > 0) {
                    paths = opts.paths;
                    foundConfig = true;
                    break;
                }
            } catch (e) {
                // If parse fails, continue
            }
        }
    }

    const aliases = [];
    const jestModuleNameMapper = {};

    if (foundConfig && Object.keys(paths).length > 0) {
        for (const [aliasPattern, targetArray] of Object.entries(paths)) {
            if (!Array.isArray(targetArray) || targetArray.length === 0) continue;
            const target = targetArray[0]; // e.g. "./src/*" or "src/*" or "./*"

            // Normalize alias pattern: "@/*" -> prefix "@/"
            const cleanAlias = aliasPattern.replace(/\*$/, "");
            const cleanTarget = target.replace(/^\.\//, "").replace(/\*$/, "");

            aliases.push({
                alias: cleanAlias,
                target: cleanTarget,
                pattern: aliasPattern
            });

            // Convert to Jest moduleNameMapper regex
            // e.g. "@/*" -> "^@/(.*)$": "<rootDir>/src/$1"
            if (aliasPattern.endsWith("*")) {
                const jestKey = `^${cleanAlias}(.*)$`;
                const jestVal = `<rootDir>/${cleanTarget}$1`;
                jestModuleNameMapper[jestKey] = jestVal;
            } else {
                const jestKey = `^${aliasPattern}$`;
                const jestVal = `<rootDir>/${cleanTarget}`;
                jestModuleNameMapper[jestKey] = jestVal;
            }
        }
    } else {
        // Fallback: If src directory exists, map @/ -> src/
        const srcExists = fs.existsSync(path.join(projectRoot, "src"));
        const targetDir = srcExists ? "src/" : "";
        aliases.push({
            alias: "@/",
            target: targetDir,
            pattern: "@/*"
        });
        jestModuleNameMapper["^@/(.*)$"] = `<rootDir>/${targetDir}$1`;
    }

    return {
        foundConfig,
        baseUrl,
        aliases,
        jestModuleNameMapper
    };
}

module.exports = {
    resolvePathAliases
};
