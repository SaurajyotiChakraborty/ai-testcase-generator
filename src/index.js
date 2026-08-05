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
    "coverage"
];

function scanFolder(folderPath) {

    const files = [];

    function scan(currentPath) {

        const items =
            fs.readdirSync(currentPath);

        for (const item of items) {

            if (ignoredFolders.includes(item)) {
                continue;
            }

            const fullPath =
                path.join(currentPath, item);

            const stats =
                fs.statSync(fullPath);

            if (stats.isDirectory()) {

                scan(fullPath);

            } else {

                const extension =
                    path.extname(fullPath);

                if (supportedExtensions.includes(extension)) {

                    files.push(fullPath);

                }

            }

        }

    }

    scan(folderPath);

    return files;

}

module.exports = {

    scanFolder

};