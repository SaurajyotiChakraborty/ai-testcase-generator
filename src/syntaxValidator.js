const { Project, SyntaxKind } = require("ts-morph");

/**
 * Validates the syntax of the generated code.
 * Also ensures no TypeScript specific syntax (like `as Type`) is used in JS files.
 *
 * @param {string} code - The generated code.
 * @param {string} ext - The extension (e.g. '.js', '.ts', '.jsx', '.tsx', '.py').
 * @returns {object} { isValid: boolean, error: string | null }
 */
function validateSyntax(code, ext) {
    // If python, we'll skip for now as requested by user, or implement later.
    if (ext === ".py") {
        return { isValid: true, error: null };
    }

    const project = new Project({ useInMemoryFileSystem: true });
    // Use the specific extension to ensure parser applies correct rules (e.g., JSX in .jsx)
    const sourceFile = project.createSourceFile(`test${ext}`, code);

    // 1. Check for basic syntax errors (codes < 2000 are parsing errors, avoiding semantic/module-resolution errors)
    const diagnostics = sourceFile.getPreEmitDiagnostics();
    const syntaxErrors = diagnostics.filter(d => d.getCategory() === 1 /* Error */ && d.getCode() < 2000);

    if (syntaxErrors.length > 0) {
        // Collect first error details
        const firstError = syntaxErrors[0];
        let errorMsg = firstError.getMessageText();
        if (typeof errorMsg !== "string") {
            errorMsg = errorMsg.getMessageText();
        }
        const line = firstError.getLineNumber();
        const start = firstError.getStart();
        const length = firstError.getLength();
        
        return {
            isValid: false,
            error: `Syntax Error at line ${line}: ${errorMsg}`
        };
    }

    // 2. Check for Language Mismatch (TS syntax in JS/JSX)
    if (ext === ".js" || ext === ".jsx") {
        const asExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression);
        if (asExpressions.length > 0) {
            return {
                isValid: false,
                error: `TypeScript type assertion ("as Type") found in JavaScript file.`
            };
        }

        const typeAssertions = sourceFile.getDescendantsOfKind(SyntaxKind.TypeAssertionExpression);
        if (typeAssertions.length > 0) {
            return {
                isValid: false,
                error: `TypeScript type assertion found in JavaScript file.`
            };
        }
        
        const typeAliases = sourceFile.getDescendantsOfKind(SyntaxKind.TypeAliasDeclaration);
        if (typeAliases.length > 0) {
            return {
                isValid: false,
                error: `TypeScript type alias declaration found in JavaScript file.`
            };
        }

        const interfaces = sourceFile.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration);
        if (interfaces.length > 0) {
            return {
                isValid: false,
                error: `TypeScript interface declaration found in JavaScript file.`
            };
        }
    }

    return { isValid: true, error: null };
}

module.exports = {
    validateSyntax
};
