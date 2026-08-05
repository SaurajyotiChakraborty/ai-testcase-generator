const fs = require("fs");
const { registry } = require("./functionRegistry");

function exportRegistry() {

    fs.writeFileSync(
        "./analysis.json",
        JSON.stringify(registry, null, 4)
    );

    console.log(
        "analysis.json generated successfully."
    );
}

module.exports = {
    exportRegistry
};