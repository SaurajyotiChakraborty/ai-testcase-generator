const fs = require("fs");

function readAnalysis() {

    try {

        const data = fs.readFileSync(
            "./analysis.json",
            "utf8"
        );

        return JSON.parse(data);

    } catch (error) {

        console.warn(
            "Warning: Could not read analysis.json —",
            error.message
        );

        return [];

    }
}

module.exports = {
    readAnalysis
};