const dependencyGraph = [];

function addDependency(fromFile, importedFunction, sourceFile) {

    dependencyGraph.push({
        fromFile,
        importedFunction,
        sourceFile
    });

}

module.exports = {
    dependencyGraph,
    addDependency
};