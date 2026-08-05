const fs = require("fs");
const path = require("path");

function writeTestFile(testCode, fileName) {

    const testFileName =
        fileName.replace(
            path.extname(fileName),
            ".test.js"
        );

    const outputFolder =
        "./generated-tests";

    if (!fs.existsSync(outputFolder)) {

        fs.mkdirSync(outputFolder);

    }

    const outputPath =
        path.join(
            outputFolder,
            testFileName
        );

    fs.writeFileSync(
        outputPath,
        testCode,
        "utf8"
    );

    console.log(
        `${testFileName} created successfully.`
    );
}

module.exports = {
    writeTestFile
};