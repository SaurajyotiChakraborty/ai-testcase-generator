const fs = require("fs");
const path = require("path");

function writeTestFile(testCode, fileName, outputDir) {

    const testFileName = fileName;


    const outputFolder = outputDir || "./generated-tests";

    const outputPath =
        path.join(
            outputFolder,
            testFileName
        );
        
    const finalDir = path.dirname(outputPath);
    if (!fs.existsSync(finalDir)) {
        fs.mkdirSync(finalDir, { recursive: true });
    }

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