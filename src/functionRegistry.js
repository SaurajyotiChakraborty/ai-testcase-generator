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

        exports: false

    });

}

function addCall(
    functionName,
    calledFunction
) {

    const func =
        registry.find(
            f => f.name === functionName
        );

    if (func) {

        func.call.push(
            calledFunction
        );

    }

}

function addCondition(
    functionName,
    condition
) {

    const func =
        registry.find(
            f => f.name === functionName
        );

    if (func) {

        func.conditions.push(
            condition
        );

    }

}

function addReturn(
    functionName,
    value
) {

    const func =
        registry.find(
            f => f.name === functionName
        );

    if (func) {

        func.returns.push(
            value
        );

    }

}

function addThrow(
    functionName,
    value
) {

    const func =
        registry.find(
            f => f.name === functionName
        );

    if (func) {

        func.throws.push(
            value
        );

    }

}

function markExport(
    functionName
) {

    const func =
        registry.find(
            f => f.name === functionName
        );

    if (func) {

        func.exports = true;

    }

}

module.exports = {

    registry,

    registerFunction,

    addCall,

    addCondition,

    addReturn,

    addThrow,

    markExport

};