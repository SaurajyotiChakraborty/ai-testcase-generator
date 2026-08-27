const fs = require("fs");
const path = require("path");
const { registry } = require("./functionRegistry");
const { dependencyGraph } = require("./dependencyGraph");

function exportRegistry() {

    // Always write analysis.json to the project root (process.cwd())
    const outputPath = path.resolve(process.cwd(), "analysis.json");

    fs.writeFileSync(
        outputPath,
        JSON.stringify({ registry, dependencyGraph }, null, 4)
    );

    console.log(
        `analysis.json generated successfully at ${outputPath}`
    );
}

module.exports = {
    exportRegistry
};