const { readAnalysis } = require("./readAnalysis");

function getFileAnalysis(fileName) {

    const analysis = readAnalysis();

    return analysis.filter(
        item => item.file === fileName
    );

}

module.exports = {
    getFileAnalysis
};