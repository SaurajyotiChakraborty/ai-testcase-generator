const { SyntaxKind } = require("ts-morph");

/**
 * Analyzes data flow within a function-like AST node.
 * Tracks variable declarations, assignments, and parameter usage.
 *
 * @param {object} funcNode - A ts-morph function/arrow/method node
 * @param {string[]} parameterNames - Array of parameter names for the function
 * @returns {object} Data flow analysis data
 */
function analyzeDataFlow(funcNode, parameterNames) {

    const variables = [];
    const parameterUsage = [];

    /* ---------------- VARIABLE DECLARATIONS ---------------- */

    const variableDeclarations =
        funcNode.getDescendantsOfKind(
            SyntaxKind.VariableDeclaration
        );

    for (const varDecl of variableDeclarations) {

        const varName = varDecl.getName();

        // Determine the declaration kind (const, let, var)
        let kind = "unknown";

        try {

            // Navigate: VariableDeclaration -> VariableDeclarationList -> VariableStatement
            const declarationList = varDecl.getParent();

            if (declarationList && declarationList.getKind() === SyntaxKind.VariableDeclarationList) {

                const keyword = declarationList.getFlags();
                const text = declarationList.getText();

                if (text.startsWith("const ")) {
                    kind = "const";
                } else if (text.startsWith("let ")) {
                    kind = "let";
                } else if (text.startsWith("var ")) {
                    kind = "var";
                }

            }

        } catch (e) {
            // Keep as "unknown"
        }

        // Get initial value
        const initializer = varDecl.getInitializer();
        const initialValue = initializer
            ? initializer.getText()
            : "undefined";

        // Count usages of this variable in the function body
        const usageCount =
            countIdentifierUsages(funcNode, varName) - 1;
        // Subtract 1 for the declaration itself

        // Check if variable is reassigned (look for assignment expressions)
        const reassigned =
            isVariableReassigned(funcNode, varName);

        variables.push({
            name: varName,
            kind: kind,
            initialValue: truncateValue(initialValue),
            reassigned: reassigned,
            usageCount: Math.max(usageCount, 0)
        });

    }

    /* ---------------- PARAMETER USAGE ANALYSIS ---------------- */

    for (const paramName of parameterNames) {

        const usageCount =
            countIdentifierUsages(funcNode, paramName);

        parameterUsage.push({
            name: paramName,
            used: usageCount > 0,
            usageCount: usageCount
        });

    }

    return {
        variables,
        parameterUsage
    };

}

/**
 * Counts how many times an identifier name appears in the function body.
 */
function countIdentifierUsages(funcNode, name) {

    const identifiers =
        funcNode.getDescendantsOfKind(
            SyntaxKind.Identifier
        );

    let count = 0;

    for (const id of identifiers) {

        if (id.getText() === name) {
            count++;
        }

    }

    return count;

}

/**
 * Checks if a variable is reassigned anywhere in the function body.
 * Looks for BinaryExpression with assignment operators where
 * the left side matches the variable name.
 */
function isVariableReassigned(funcNode, varName) {

    const binaryExpressions =
        funcNode.getDescendantsOfKind(
            SyntaxKind.BinaryExpression
        );

    for (const expr of binaryExpressions) {

        const left = expr.getLeft().getText();
        const operator = expr.getOperatorToken().getText();

        const assignmentOperators = [
            "=", "+=", "-=", "*=", "/=",
            "%=", "**=", "<<=", ">>=",
            ">>>=", "&=", "|=", "^=",
            "&&=", "||=", "??="
        ];

        if (
            left === varName &&
            assignmentOperators.includes(operator)
        ) {
            return true;
        }

    }

    // Also check for ++ and -- (prefix and postfix)
    const prefixUnary =
        funcNode.getDescendantsOfKind(
            SyntaxKind.PrefixUnaryExpression
        );

    for (const expr of prefixUnary) {

        const operand = expr.getOperand().getText();
        const operator = expr.getOperatorToken();

        if (
            operand === varName &&
            (operator === SyntaxKind.PlusPlusToken ||
             operator === SyntaxKind.MinusMinusToken)
        ) {
            return true;
        }

    }

    const postfixUnary =
        funcNode.getDescendantsOfKind(
            SyntaxKind.PostfixUnaryExpression
        );

    for (const expr of postfixUnary) {

        const operand = expr.getOperand().getText();
        const operator = expr.getOperatorToken();

        if (
            operand === varName &&
            (operator === SyntaxKind.PlusPlusToken ||
             operator === SyntaxKind.MinusMinusToken)
        ) {
            return true;
        }

    }

    return false;

}

/**
 * Truncates long values for readability in analysis output.
 */
function truncateValue(value) {

    const maxLength = 80;

    if (value.length > maxLength) {
        return value.substring(0, maxLength) + "...";
    }

    return value;

}

module.exports = {
    analyzeDataFlow
};
