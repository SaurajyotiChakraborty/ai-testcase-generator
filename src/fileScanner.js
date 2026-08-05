const fs = require("fs");
const path = require("path");

const supportedExtensions = [
    ".js",
    ".ts",
    ".jsx",
    ".tsx"
];

function scanFolder(folderPath, files = []) {

    const items = fs.readdirSync(folderPath);

    for (const item of items) {

        const fullPath = path.join(
            folderPath,
            item
        );

        const stat =
            fs.statSync(fullPath);

        if (stat.isDirectory()) {

            scanFolder(
                fullPath,
                files
            );

        } else {

            const ext =
                path.extname(fullPath);

            if (
                supportedExtensions.includes(ext)
            ) {
                files.push(fullPath);
            }
        }
    }

    return files;
}

module.exports = {
    scanFolder
};