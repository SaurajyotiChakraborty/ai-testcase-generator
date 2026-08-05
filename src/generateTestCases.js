const path = require("path");

const ai = require("./gemini");

const {
    scanFolder
} = require("./fileScanner");

const {
    getFileAnalysis
} = require("./getFileAnalysis");

const {
    buildPrompt
} = require("./promptBuilder");

const {
    writeTestFile
} = require("./writeTestFile");

async function generateTestCases() {

    const files =
        scanFolder("./src");

    for (const file of files) {

        if (
            file.includes(".test.") ||
            file.includes("generateTestCases") ||
            file.includes("parser") ||
            file.includes("Registry") ||
            file.includes("Scanner") ||
            file.includes("Prompt") ||
            file.includes("gemini") ||
            file.includes("Analysis")
        ) {
            continue;
        }

        const fileName =
            path.basename(file);

        const analysis =
            getFileAnalysis(fileName);

        if (!analysis || analysis.length === 0) {

            console.log(
                `Skipping ${fileName} (No functions found)`
            );

            continue;
        }

        console.log(
            `\nGenerating tests for ${fileName}...`
        );

        try {

            const prompt =
                buildPrompt(analysis);

            const response =
                await ai.models.generateContent({
                    model: "gemini-3.6-flash",
                    contents: prompt
                });

            const cleaned =
                (response.text || "")
                    .replace(/```javascript/g, "")
                    .replace(/```js/g, "")
                    .replace(/```/g, "")
                    .trim();

            writeTestFile(
                cleaned,
                fileName
            );

            console.log(
                `✅ ${fileName} completed`
            );

        } catch (error) {

            console.log(
                `❌ Failed to generate tests for ${fileName}`
            );

            console.log(error.message);

            continue;
        }
    }

    console.log(
        "\n🎉 Finished generating all test files."
    );
}

generateTestCases();