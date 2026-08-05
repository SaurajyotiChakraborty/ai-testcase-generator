const {
    parseImports
} = require("./importParser");

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
    addThrow
} = require("./functionRegistry");

const {
    exportRegistry
} = require("./exportRegistry");

const project = new Project();

/* ---------------- LOAD ALL FILES ---------------- */

const files =
    scanFolder("./src");

for (const file of files) {

    project.addSourceFileAtPath(file);

}

const sourceFiles =
    project.getSourceFiles();

/* ---------------- PARSE EACH FILE ---------------- */

for (const sourceFile of sourceFiles) {

    console.log(
        "\n=================================="
    );

    console.log(
        "Parsing:",
        sourceFile.getBaseName()
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
            sourceFile.getBaseName(),
            imp.importedFunction,
            imp.sourceFile
        );

    }

    console.log(
        "=================================="
    );

    /* ---------------- NORMAL FUNCTIONS ---------------- */

    const functions =
        sourceFile.getFunctions();

    for (const func of functions) {

        console.log(
            "\nNormal Function:"
        );

        console.log(
            "Name:",
            func.getName()
        );

        const params =
            func.getParameters();

        console.log(
            "Parameters:",
            params.map(
                p => p.getName()
            )
        );

        registerFunction(
            func.getName(),
            sourceFile.getBaseName(),
            "normal",
            params.map(
                p => p.getName()
            ),
            func.getBody()
                ? func.getBody().getText()
                : ""
        );

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

            console.log(
                "\nArrow Function:"
            );

            console.log(
                "Name:",
                variable.getName()
            );

            console.log(
                "Parameters:",
                initializer
                    .getParameters()
                    .map(
                        p => p.getName()
                    )
            );

            registerFunction(
                variable.getName(),
                sourceFile.getBaseName(),
                "arrow",
                initializer
                    .getParameters()
                    .map(
                        p => p.getName()
                    ),
                initializer
                    .getBody()
                    .getText()
            );

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

            console.log(
                "Method:",
                method.getName()
            );

            console.log(
                "Parameters:",
                method
                    .getParameters()
                    .map(
                        p => p.getName()
                    )
            );

            registerFunction(
                method.getName(),
                sourceFile.getBaseName(),
                "class-method",
                method
                    .getParameters()
                    .map(
                        p => p.getName()
                    ),
                method
                    .getBody()
                    ? method.getBody().getText()
                    : ""
            );

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

    for (const func of functions) {

        const functionName =
            func.getName();

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
                calledFunction
            );

        }

    }

    /* ---------------- DECISION EXTRACTION ---------------- */

    console.log(
        "\nDecision Extraction"
    );

    for (const func of functions) {

        const ifStatements =
            func.getDescendantsOfKind(
                SyntaxKind.IfStatement
            );

        console.log(
            "\nFunction:",
            func.getName()
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
                func.getName(),
                condition
            );

        }

    }

    /* ---------------- RETURN EXTRACTION ---------------- */

    console.log(
        "\nReturn Extraction"
    );

    for (const func of functions) {

        const returns =
            func.getDescendantsOfKind(
                SyntaxKind.ReturnStatement
            );

        console.log(
            "\nFunction:",
            func.getName()
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
                    func.getName(),
                    value
                );

            }

        }

    }

    /* ---------------- THROW EXTRACTION ---------------- */

    console.log(
        "\nThrow Extraction"
    );

    for (const func of functions) {

        const throws =
            func.getDescendantsOfKind(
                SyntaxKind.ThrowStatement
            );

        console.log(
            "\nFunction:",
            func.getName()
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
                    func.getName(),
                    error
                );

            }

        }

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
    registry
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

/* ---------------- EXPORT ANALYSIS ---------------- */

exportRegistry();

console.log(
    "\n=================================="
);

console.log(
    "Analysis Complete"
);

console.log(
    "=================================="
);