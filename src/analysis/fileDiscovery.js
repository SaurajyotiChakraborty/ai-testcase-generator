const fs = require("fs");
const path = require("path");

const DEFAULT_IGNORE = [
    "node_modules",
    ".next",
    "dist",
    "build",
    "coverage",
    ".git",
    "generated-tests"
];

function discoverFiles(targetPath, ignoreRules = []) {
    const absPath = path.resolve(targetPath);
    if (!fs.existsSync(absPath)) {
        throw new Error(`Target path does not exist: ${targetPath}`);
    }

    const stat = fs.statSync(absPath);
    if (stat.isFile()) {
        const ext = path.extname(absPath);
        if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext)) {
            return [absPath];
        }
        throw new Error(`Unsupported file extension: ${ext}`);
    }

    const results = [];
    const combinedIgnore = [...DEFAULT_IGNORE, ...ignoreRules];

    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const name = entry.name;
            if (combinedIgnore.some(rule => name.includes(rule) || dir.includes(rule))) {
                continue;
            }

            const fullPath = path.join(dir, name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(name);
                if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext)) {
                    if (!name.includes(".test.") && !name.includes(".spec.")) {
                        results.push(fullPath);
                    }
                }
            }
        }
    }

    walk(absPath);
    return results;
}

module.exports = {
    discoverFiles
};
