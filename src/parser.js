const {
    parseImports
} = require("./importParser");

const {
    parseExports
} = require("./exportParser");

const {
    addDependency,
    dependencyGraph
} = require("./dependencyGraph");

const {
    scanFolder
} = require("./fileScanner");

const {
    Project,
    SyntaxKind
} = require("ts-morph");

const {
    registerFunction,
    registry,
    addCall,
    addCondition,
    addReturn,
    addThrow,
    markExport,
    addControlFlow,
    addDataFlow,
    addComplexity
} = require("./functionRegistry");

const {
    exportRegistry
} = require("./exportRegistry");

const {
    buildCFG
} = require("./cfgBuilder");

const {
    analyzeDataFlow
} = require("./dataFlowAnalyzer");

const {
    analyzeComplexity
} = require("./complexityAnalyzer");

function runParser(targetPath = "./src", verbose = true, ignore = []) {

    function log(...args) {
        if (verbose) {
            console.log(...args);
        }
    }

    // Reset registry and dependencyGraph if this is called multiple times in same process
    registry.length = 0;
    dependencyGraph.length = 0;

    const project = new Project();

    /* ---------------- LOAD ALL FILES ---------------- */

    const files =
        scanFolder(targetPath, ignore);

    for (const file of files) {

    project.addSourceFileAtPath(file);

}

const sourceFiles =
    project.getSourceFiles();

/* ---------------- PARSE EACH FILE ---------------- */

for (const sourceFile of sourceFiles) {

    const currentFileName =
        sourceFile.getBaseName();

    console.log(
        "\n=================================="
    );

    console.log(
        "Parsing:",
        currentFileName
    );

    /* ---------------- IMPORTS ---------------- */

    const imports =
        parseImports(sourceFile);

    for (const imp of imports) {

        console.log(
            "Import:",
            imp.importedFunction,
            "<-",
            imp.sourceFile
        );

        addDependency(
            currentFileName,
            imp.importedFunction,
            imp.sourceFile
        );

    }

    console.log(
        "=================================="
    );

    /* ---------------- COLLECT ALL FUNCTIONS ---------------- */

    // We collect all function-like nodes with their names and parameters
    // so semantic analysis runs on ALL of them, not just normal functions.

    const allFunctions = [];

    /* ---------------- NORMAL FUNCTIONS ---------------- */

    const functions =
        sourceFile.getFunctions();

    for (const func of functions) {

        const funcName = func.getName();

        console.log(
            "\nNormal Function:"
        );

        console.log(
            "Name:",
            funcName
        );

        const params =
            func.getParameters();

        const paramNames =
            params.map(
                p => p.getName()
            );

        console.log(
            "Parameters:",
            paramNames
        );

        registerFunction(
            funcName,
            currentFileName,
            "normal",
            paramNames,
            func.getBody()
                ? func.getBody().getText()
                : ""
        );

        // Add to unified list for semantic analysis
        allFunctions.push({
            name: funcName,
            node: func,
            paramNames: paramNames
        });

    }

    /* ---------------- ARROW FUNCTIONS ---------------- */

    const variables =
        sourceFile.getVariableDeclarations();

    for (const variable of variables) {

        const initializer =
            variable.getInitializer();

        if (
            initializer &&
            initializer.getKind() ===
                SyntaxKind.ArrowFunction
        ) {

            const varName = variable.getName();

            console.log(
                "\nArrow Function:"
            );

            console.log(
                "Name:",
                varName
            );

            const paramNames =
                initializer
                    .getParameters()
                    .map(
                        p => p.getName()
                    );

            console.log(
                "Parameters:",
                paramNames
            );

            registerFunction(
                varName,
                currentFileName,
                "arrow",
                paramNames,
                initializer
                    .getBody()
                    .getText()
            );

            // Add to unified list for semantic analysis
            allFunctions.push({
                name: varName,
                node: initializer,
                paramNames: paramNames
            });

        }

    }

    /* ---------------- CLASS METHODS ---------------- */

    const classes =
        sourceFile.getClasses();

    for (const cls of classes) {

        console.log(
            "\nClass:",
            cls.getName()
        );

        const methods =
            cls.getMethods();

        for (const method of methods) {

            const methodName = method.getName();

            console.log(
                "Method:",
                methodName
            );

            const paramNames =
                method
                    .getParameters()
                    .map(
                        p => p.getName()
                    );

            console.log(
                "Parameters:",
                paramNames
            );

            registerFunction(
                methodName,
                currentFileName,
                "class-method",
                paramNames,
                method
                    .getBody()
                    ? method.getBody().getText()
                    : ""
            );

            // Add to unified list for semantic analysis
            allFunctions.push({
                name: methodName,
                node: method,
                paramNames: paramNames
            });

        }

    }

    /* ---------------- ALL FUNCTION CALLS ---------------- */

    const callExpressions =
        sourceFile.getDescendantsOfKind(
            SyntaxKind.CallExpression
        );

    console.log(
        "\nFunction Calls:"
    );

    for (const call of callExpressions) {

        console.log(
            call
                .getExpression()
                .getText()
        );

    }

    /* ---------------- CALLER -> CALLEE MAP ---------------- */

    console.log(
        "\nCaller -> Callee Map"
    );

    for (const { name: functionName, node: func } of allFunctions) {

        const calls =
            func.getDescendantsOfKind(
                SyntaxKind.CallExpression
            );

        for (const call of calls) {

            const calledFunction =
                call
                    .getExpression()
                    .getText();

            console.log(
                `${functionName} -> ${calledFunction}`
            );

            addCall(
                functionName,
                currentFileName,
                calledFunction
            );

        }

    }

    /* ---------------- DECISION EXTRACTION ---------------- */

    console.log(
        "\nDecision Extraction"
    );

    for (const { name: functionName, node: func } of allFunctions) {

        const ifStatements =
            func.getDescendantsOfKind(
                SyntaxKind.IfStatement
            );

        console.log(
            "\nFunction:",
            functionName
        );

        for (const ifStatement of ifStatements) {

            const condition =
                ifStatement
                    .getExpression()
                    .getText();

            console.log(
                "Condition:",
                condition
            );

            addCondition(
                functionName,
                currentFileName,
                condition
            );

        }

    }

    /* ---------------- RETURN EXTRACTION ---------------- */

    console.log(
        "\nReturn Extraction"
    );

    for (const { name: functionName, node: func } of allFunctions) {

        const returns =
            func.getDescendantsOfKind(
                SyntaxKind.ReturnStatement
            );

        console.log(
            "\nFunction:",
            functionName
        );

        for (const ret of returns) {

            if (ret.getExpression()) {

                const value =
                    ret
                        .getExpression()
                        .getText();

                console.log(
                    "Returns:",
                    value
                );

                addReturn(
                    functionName,
                    currentFileName,
                    value
                );

            }

        }

    }

    /* ---------------- THROW EXTRACTION ---------------- */

    console.log(
        "\nThrow Extraction"
    );

    for (const { name: functionName, node: func } of allFunctions) {

        const throws =
            func.getDescendantsOfKind(
                SyntaxKind.ThrowStatement
            );

        console.log(
            "\nFunction:",
            functionName
        );

        for (const thr of throws) {

            if (thr.getExpression()) {

                const error =
                    thr
                        .getExpression()
                        .getText();

                console.log(
                    "Throws:",
                    error
                );

                addThrow(
                    functionName,
                    currentFileName,
                    error
                );

            }

        }

    }

    /* ---------------- EXPORT DETECTION ---------------- */

    console.log(
        "\nExport Detection"
    );

    const exportedNames =
        parseExports(sourceFile);

    for (const exportedName of exportedNames) {

        console.log(
            "Exported:",
            exportedName
        );

        markExport(
            exportedName,
            currentFileName
        );

    }

    /* ---------------- CONTROL FLOW GRAPH ---------------- */

    console.log(
        "\nControl Flow Analysis"
    );

    for (const { name: functionName, node: func } of allFunctions) {

        const cfg = buildCFG(func);

        console.log(
            `${functionName}: ${cfg.branches.length} branches, ` +
            `${cfg.loops.length} loops, ` +
            `${cfg.tryCatch.length} try/catch, ` +
            `${cfg.pathCount} paths`
        );

        addControlFlow(
            functionName,
            currentFileName,
            cfg
        );

    }

    /* ---------------- DATA FLOW ANALYSIS ---------------- */

    console.log(
        "\nData Flow Analysis"
    );

    for (const { name: functionName, node: func, paramNames } of allFunctions) {

        const dataFlow =
            analyzeDataFlow(func, paramNames);

        console.log(
            `${functionName}: ${dataFlow.variables.length} variables, ` +
            `${dataFlow.parameterUsage.length} params tracked`
        );

        addDataFlow(
            functionName,
            currentFileName,
            dataFlow
        );

    }

    /* ---------------- COMPLEXITY ANALYSIS ---------------- */

    console.log(
        "\nComplexity Analysis"
    );

    for (const { name: functionName, node: func } of allFunctions) {

        const complexity =
            analyzeComplexity(func);

        log(
            `${functionName}: cyclomatic=${complexity.cyclomatic}, ` +
            `depth=${complexity.maxNestingDepth}, ` +
            `LOC=${complexity.linesOfCode}, ` +
            `[${complexity.classification}]`
        );

        addComplexity(
            functionName,
            currentFileName,
            complexity
        );

    }

} // ---------- End of sourceFile loop ----------

/* ---------------- FUNCTION REGISTRY ---------------- */

console.log(
    "\n=================================="
);

console.log(
    "Function Registry"
);

console.log(
    "=================================="
);

console.log(
    JSON.stringify(registry, null, 2)
);

/* ---------------- DEPENDENCY GRAPH ---------------- */

console.log(
    "\n=================================="
);

console.log(
    "Dependency Graph"
);

console.log(
    "=================================="
);

console.log(
    dependencyGraph
);

/* ---------------- EXPORT ANALYSIS TO JSON ---------------- */

exportRegistry();

    log(
        "\n=================================="
    );

    log(
        "Analysis Complete"
    );

    log(
        "=================================="
    );

    return {
        registry,
        dependencyGraph
    };

} // ---------- End of runParser ----------

if (require.main === module) {
    runParser("./src", true);
}

module.exports = {
    runParser
};