const registry = [];

function registerFunction(
    name,
    file,
    type,
    parameters,
    body
) {

    registry.push({

        name,
        file,
        type,

        parameters,

        body,

        conditions: [],

        returns: [],

        throws: [],

        call: [],

        exports: false,

        controlFlow: null,

        dataFlow: null,

        complexity: null

    });

}

function addCall(
    functionName,
    fileName,
    calledFunction
) {

    const func =
        registry.find(
            f => f.name === functionName &&
                 f.file === fileName
        );

    if (func) {

        func.call.push(
            calledFunction
        );

    }

}

function addCondition(
    functionName,
    fileName,
    condition
) {

    const func =
        registry.find(
            f => f.name === functionName &&
                 f.file === fileName
        );

    if (func) {

        func.conditions.push(
            condition
        );

    }

}

function addReturn(
    functionName,
    fileName,
    value
) {

    const func =
        registry.find(
            f => f.name === functionName &&
                 f.file === fileName
        );

    if (func) {

        func.returns.push(
            value
        );

    }

}

function addThrow(
    functionName,
    fileName,
    value
) {

    const func =
        registry.find(
            f => f.name === functionName &&
                 f.file === fileName
        );

    if (func) {

        func.throws.push(
            value
        );

    }

}

function markExport(
    functionName,
    fileName
) {

    const func =
        registry.find(
            f => f.name === functionName &&
                 f.file === fileName
        );

    if (func) {

        func.exports = true;

    }

}

function addControlFlow(
    functionName,
    fileName,
    cfgData
) {

    const func =
        registry.find(
            f => f.name === functionName &&
                 f.file === fileName
        );

    if (func) {

        func.controlFlow = cfgData;

    }

}

function addDataFlow(
    functionName,
    fileName,
    dataFlowData
) {

    const func =
        registry.find(
            f => f.name === functionName &&
                 f.file === fileName
        );

    if (func) {

        func.dataFlow = dataFlowData;

    }

}

function addComplexity(
    functionName,
    fileName,
    complexityData
) {

    const func =
        registry.find(
            f => f.name === functionName &&
                 f.file === fileName
        );

    if (func) {

        func.complexity = complexityData;

    }

}

module.exports = {

    registry,

    registerFunction,

    addCall,

    addCondition,

    addReturn,

    addThrow,

    markExport,

    addControlFlow,

    addDataFlow,

    addComplexity

};