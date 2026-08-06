const { SyntaxKind } = require("ts-morph");

/**
 * Analyzes complexity metrics for a function-like AST node.
 *
 * @param {object} funcNode - A ts-morph function/arrow/method node
 * @returns {object} Complexity metrics
 */
function analyzeComplexity(funcNode) {

    let cyclomatic = 1; // Base complexity

    /* ---------------- DECISION POINTS ---------------- */

    // if statements
    const ifCount =
        funcNode.getDescendantsOfKind(
            SyntaxKind.IfStatement
        ).length;

    cyclomatic += ifCount;

    // case clauses (each case adds a branch)
    const caseCount =
        funcNode.getDescendantsOfKind(
            SyntaxKind.CaseClause
        ).length;

    cyclomatic += caseCount;

    // catch clauses
    const catchCount =
        funcNode.getDescendantsOfKind(
            SyntaxKind.CatchClause
        ).length;

    cyclomatic += catchCount;

    // for loops
    const forCount =
        funcNode.getDescendantsOfKind(
            SyntaxKind.ForStatement
        ).length;

    cyclomatic += forCount;

    // for-in loops
    const forInCount =
        funcNode.getDescendantsOfKind(
            SyntaxKind.ForInStatement
        ).length;

    cyclomatic += forInCount;

    // for-of loops
    const forOfCount =
        funcNode.getDescendantsOfKind(
            SyntaxKind.ForOfStatement
        ).length;

    cyclomatic += forOfCount;

    // while loops
    const whileCount =
        funcNode.getDescendantsOfKind(
            SyntaxKind.WhileStatement
        ).length;

    cyclomatic += whileCount;

    // do-while loops
    const doWhileCount =
        funcNode.getDescendantsOfKind(
            SyntaxKind.DoStatement
        ).length;

    cyclomatic += doWhileCount;

    // Ternary / conditional expressions
    const ternaryCount =
        funcNode.getDescendantsOfKind(
            SyntaxKind.ConditionalExpression
        ).length;

    cyclomatic += ternaryCount;

    // Logical AND (&&) — each adds a short-circuit branch
    const logicalAndCount =
        countBinaryOperator(funcNode, "&&");

    cyclomatic += logicalAndCount;

    // Logical OR (||) — each adds a short-circuit branch
    const logicalOrCount =
        countBinaryOperator(funcNode, "||");

    cyclomatic += logicalOrCount;

    // Nullish coalescing (??) — adds a branch
    const nullishCount =
        countBinaryOperator(funcNode, "??");

    cyclomatic += nullishCount;

    /* ---------------- NESTING DEPTH ---------------- */

    const maxNestingDepth =
        calculateMaxNestingDepth(funcNode);

    /* ---------------- LINES OF CODE ---------------- */

    const body = funcNode.getBody
        ? funcNode.getBody()
        : null;

    let linesOfCode = 0;

    if (body) {

        const text = body.getText();
        linesOfCode = text.split(/\r?\n/).length;

    }

    /* ---------------- CLASSIFICATION ---------------- */

    let classification;

    if (cyclomatic <= 5) {
        classification = "simple";
    } else if (cyclomatic <= 10) {
        classification = "moderate";
    } else if (cyclomatic <= 20) {
        classification = "complex";
    } else {
        classification = "very-complex";
    }

    return {
        cyclomatic,
        maxNestingDepth,
        linesOfCode,
        classification
    };

}

/**
 * Counts occurrences of a specific binary operator in the function.
 */
function countBinaryOperator(funcNode, operator) {

    const binaryExpressions =
        funcNode.getDescendantsOfKind(
            SyntaxKind.BinaryExpression
        );

    let count = 0;

    for (const expr of binaryExpressions) {

        if (expr.getOperatorToken().getText() === operator) {
            count++;
        }

    }

    return count;

}

/**
 * Calculates the maximum nesting depth of control structures.
 * Counts nested if, for, while, do-while, switch, try blocks.
 */
function calculateMaxNestingDepth(funcNode) {

    const nestingKinds = [
        SyntaxKind.IfStatement,
        SyntaxKind.ForStatement,
        SyntaxKind.ForInStatement,
        SyntaxKind.ForOfStatement,
        SyntaxKind.WhileStatement,
        SyntaxKind.DoStatement,
        SyntaxKind.SwitchStatement,
        SyntaxKind.TryStatement
    ];

    let maxDepth = 0;

    function walk(node, currentDepth) {

        const kind = node.getKind();

        let newDepth = currentDepth;

        if (nestingKinds.includes(kind)) {
            newDepth = currentDepth + 1;

            if (newDepth > maxDepth) {
                maxDepth = newDepth;
            }
        }

        for (const child of node.getChildren()) {
            walk(child, newDepth);
        }

    }

    walk(funcNode, 0);

    return maxDepth;

}

module.exports = {
    analyzeComplexity
};
