const fs = require("fs");
const path = require("path");

// The analysis file is always written to the project root (process.cwd())
// This fixes the error when codecase-ai is run from a directory
// different from where analysis.json was written.
function getAnalysisPath() {
    return path.resolve(process.cwd(), "analysis.json");
}

function readAnalysis() {

    const analysisPath = getAnalysisPath();

    try {

        const data = fs.readFileSync(
            analysisPath,
            "utf8"
        );

        const parsed = JSON.parse(data);

        // Backwards compatibility for old cache format
        if (Array.isArray(parsed)) {
            return { registry: parsed, dependencyGraph: [] };
        }

        return parsed;

    } catch (error) {

        console.warn(
            `Warning: Could not read analysis.json at ${analysisPath} — ${error.message}`
        );

        return { registry: [], dependencyGraph: [] };

    }
}

module.exports = {
    readAnalysis,
    getAnalysisPath
};