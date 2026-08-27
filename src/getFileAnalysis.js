const { readAnalysis } = require("./readAnalysis");

function getFileAnalysis(fileName) {

    const analysis = readAnalysis();

    const fileFunctions = analysis.registry.filter(
        item => item.file === fileName
    );

    const fileDependencies = analysis.dependencyGraph.filter(
        item => item.fromFile === fileName
    );

    return fileFunctions.map(func => ({
        ...func,
        dependencies: fileDependencies
    }));

}

module.exports = {
    getFileAnalysis
};