const fs = require("fs");
const path = require("path");

const supportedExtensions = [
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".py",
    ".php",
    ".java",
    ".go",
    ".rs",
    ".cpp",
    ".c",
    ".cs"
];

const ignoredFolders = [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "coverage",
    "generated-tests"
];

/**
 * Recursively scans a directory for supported source files.
 * @param {string} folderPath Directory to scan
 * @param {string[]} customIgnore Optional list of folders/files to ignore
 * @returns {string[]} Array of absolute file paths
 */
function scanFolder(folderPath, customIgnore = []) {
    
    // Merge default ignored folders with any custom ones provided by user config
    const allIgnored = [...ignoredFolders, ...(customIgnore || [])];

    if (!fs.existsSync(folderPath)) {
        console.warn(`Folder or file not found: ${folderPath}`);
        return [];
    }

    const targetStat = fs.statSync(folderPath);
    if (targetStat.isFile()) {
        const ext = path.extname(folderPath);
        if (supportedExtensions.includes(ext)) {
            return [path.resolve(folderPath)];
        }
        return [];
    }

    function walk(currentDir, files) {
        if (!fs.existsSync(currentDir)) {
            console.warn(`Folder not found: ${currentDir}`);
            return files;
        }

        const items = fs.readdirSync(currentDir);

        for (const item of items) {
            if (allIgnored.includes(item)) {
                continue;
            }

            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                walk(fullPath, files);
            } else {
                const ext = path.extname(fullPath);
                if (supportedExtensions.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }

        return files;
    }

    return walk(folderPath, []);
}

module.exports = {
    scanFolder
};