const fs = require("fs");

function readAnalysis() {

    const data = fs.readFileSync(
        "./analysis.json",
        "utf8"
    );

    return JSON.parse(data);
}

module.exports = {
    readAnalysis
};