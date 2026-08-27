const fs = require("fs");
const path = require("path");

function getDeterministicTestPath(sourceFilePath, outputDir = "./generated-tests", projectRoot = process.cwd()) {
    const absSource = path.resolve(sourceFilePath);
    const absRoot = path.resolve(projectRoot);
    let relPath = path.relative(absRoot, absSource);

    if (relPath.startsWith("..")) {
        relPath = path.basename(absSource);
    }

    const ext = path.extname(relPath);
    const escapedExt = ext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const testRelPath = relPath.replace(new RegExp(`${escapedExt}$`), `.test${ext}`);
    return path.join(path.resolve(outputDir), testRelPath);
}

function writeTestFile(targetPath, code) {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(targetPath, code, "utf8");
    return targetPath;
}

module.exports = {
    getDeterministicTestPath,
    writeTestFile
};
