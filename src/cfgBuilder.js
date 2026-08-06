const { SyntaxKind } = require("ts-morph");

/**
 * Builds a Control Flow Graph summary for a function-like AST node.
 * Extracts branches, loops, try/catch blocks, and computes path count.
 *
 * @param {object} funcNode - A ts-morph function/arrow/method node
 * @returns {object} Control flow data
 */
function buildCFG(funcNode) {

    const branches = [];
    const loops = [];
    const tryCatch = [];

    /* ---------------- BRANCHES: IF / ELSE IF / ELSE ---------------- */

    const ifStatements =
        funcNode.getDescendantsOfKind(
            SyntaxKind.IfStatement
        );

    for (const ifStmt of ifStatements) {

        // Only process top-level if statements (not nested else-if)
        // An else-if is an IfStatement whose parent is another IfStatement's else clause
        const parent = ifStmt.getParent();

        if (
            parent &&
            parent.getKind() === SyntaxKind.IfStatement &&
            parent.getElseStatement() === ifStmt
        ) {
            // This is an else-if, skip — it's captured as part of the parent chain
            continue;
        }

        const branch = {
            type: "if-else",
            condition: ifStmt.getExpression().getText(),
            hasElse: false,
            elseIfCount: 0
        };

        // Walk the else-if chain
        let current = ifStmt;

        while (current) {

            const elseStatement =
                current.getElseStatement();

            if (!elseStatement) {
                break;
            }

            if (
                elseStatement.getKind() ===
                    SyntaxKind.IfStatement
            ) {
                // else-if
                branch.elseIfCount++;
                current = elseStatement;
            } else {
                // plain else block
                branch.hasElse = true;
                current = null;
            }

        }

        branches.push(branch);

    }

    /* ---------------- BRANCHES: SWITCH / CASE ---------------- */

    const switchStatements =
        funcNode.getDescendantsOfKind(
            SyntaxKind.SwitchStatement
        );

    for (const switchStmt of switchStatements) {

        const cases = [];
        let hasDefault = false;

        const clauses =
            switchStmt
                .getCaseBlock()
                .getClauses();

        for (const clause of clauses) {

            if (
                clause.getKind() ===
                    SyntaxKind.CaseClause
            ) {
                cases.push(
                    clause.getExpression().getText()
                );
            } else if (
                clause.getKind() ===
                    SyntaxKind.DefaultClause
            ) {
                hasDefault = true;
            }

        }

        branches.push({
            type: "switch",
            expression: switchStmt.getExpression().getText(),
            cases: cases,
            hasDefault: hasDefault
        });

    }

    /* ---------------- BRANCHES: TERNARY ---------------- */

    const ternaries =
        funcNode.getDescendantsOfKind(
            SyntaxKind.ConditionalExpression
        );

    for (const ternary of ternaries) {

        branches.push({
            type: "ternary",
            condition: ternary.getCondition().getText()
        });

    }

    /* ---------------- LOOPS ---------------- */

    const forStatements =
        funcNode.getDescendantsOfKind(
            SyntaxKind.ForStatement
        );

    for (const forStmt of forStatements) {

        loops.push({
            type: "for",
            condition: forStmt.getCondition()
                ? forStmt.getCondition().getText()
                : ""
        });

    }

    const whileStatements =
        funcNode.getDescendantsOfKind(
            SyntaxKind.WhileStatement
        );

    for (const whileStmt of whileStatements) {

        loops.push({
            type: "while",
            condition: whileStmt.getExpression().getText()
        });

    }

    const doWhileStatements =
        funcNode.getDescendantsOfKind(
            SyntaxKind.DoStatement
        );

    for (const doStmt of doWhileStatements) {

        loops.push({
            type: "do-while",
            condition: doStmt.getExpression().getText()
        });

    }

    const forInStatements =
        funcNode.getDescendantsOfKind(
            SyntaxKind.ForInStatement
        );

    for (const forInStmt of forInStatements) {

        loops.push({
            type: "for-in",
            iterable: forInStmt.getExpression().getText()
        });

    }

    const forOfStatements =
        funcNode.getDescendantsOfKind(
            SyntaxKind.ForOfStatement
        );

    for (const forOfStmt of forOfStatements) {

        loops.push({
            type: "for-of",
            iterable: forOfStmt.getExpression().getText()
        });

    }

    /* ---------------- TRY / CATCH / FINALLY ---------------- */

    const tryStatements =
        funcNode.getDescendantsOfKind(
            SyntaxKind.TryStatement
        );

    for (const tryStmt of tryStatements) {

        const catchClause = tryStmt.getCatchClause();
        const finallyBlock = tryStmt.getFinallyBlock();

        tryCatch.push({
            hasCatch: !!catchClause,
            hasFinally: !!finallyBlock,
            catchParam: catchClause &&
                catchClause.getVariableDeclaration()
                    ? catchClause.getVariableDeclaration().getName()
                    : null
        });

    }

    /* ---------------- PATH COUNT ESTIMATION ---------------- */

    // Simple estimation: each if adds +1 path, each switch adds (cases - 1),
    // each ternary adds +1. Loops add +1 (execute vs skip).
    let pathCount = 1;

    for (const branch of branches) {

        if (branch.type === "if-else") {
            // if/else = 2 paths, each else-if adds 1 more
            pathCount *= (2 + branch.elseIfCount);
        } else if (branch.type === "switch") {
            const caseCount = branch.cases.length +
                (branch.hasDefault ? 1 : 0);
            pathCount *= Math.max(caseCount, 1);
        } else if (branch.type === "ternary") {
            pathCount *= 2;
        }

    }

    for (const loop of loops) {
        // Each loop: execute body vs skip (or 0 iterations)
        pathCount *= 2;
    }

    return {
        branches,
        loops,
        tryCatch,
        pathCount
    };

}

module.exports = {
    buildCFG
};
