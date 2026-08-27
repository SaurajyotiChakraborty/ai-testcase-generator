const { SyntaxKind } = require("ts-morph");

/**
 * Extracts all exported names from a source file.
 * Handles:
 *   - module.exports = { add, foo }        (CJS object)
 *   - module.exports = { add: addFn }      (CJS aliased)
 *   - module.exports.foo = ...             (CJS property assignment)
 *   - export function foo() {}             (ESM named)
 *   - export const foo = ...               (ESM const/let/var)
 *   - export { foo, bar }                  (ESM named re-export)
 *   - export default function foo() {}     (ESM default)
 */
function parseExports(sourceFile) {

    const exports = [];

    // ── 1. module.exports = { ... } ─────────────────────────────────────────
    const assignments = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);

    for (const assignment of assignments) {

        let leftText = "";
        try { leftText = assignment.getLeft().getText(); } catch (_) {}

        if (leftText === "module.exports") {

            const right = assignment.getRight();

            if (right.getKind() === SyntaxKind.ObjectLiteralExpression) {

                for (const property of right.getProperties()) {
                    try {
                        // Only handle property kinds that have a getName()
                        const kind = property.getKind();

                        if (
                            kind === SyntaxKind.ShorthandPropertyAssignment ||
                            kind === SyntaxKind.PropertyAssignment
                        ) {
                            const name = property.getName();
                            if (name) exports.push(name);
                        }
                        // SpreadAssignment and other kinds are skipped safely
                    } catch (_) {
                        // Skip any property we can't read
                    }
                }
            }
        }

        // module.exports.foo = ... 
        if (leftText.startsWith("module.exports.")) {
            const name = leftText.replace("module.exports.", "").trim();
            if (name && !exports.includes(name)) exports.push(name);
        }
    }

    // ── 2. ESM: export function / export class / export const/let/var ───────
    try {
        for (const fn of sourceFile.getFunctions()) {
            if (fn.isExported && fn.isExported()) {
                const name = fn.getName();
                if (name && !exports.includes(name)) exports.push(name);
            }
        }
    } catch (_) {}

    try {
        for (const cls of sourceFile.getClasses()) {
            if (cls.isExported && cls.isExported()) {
                const name = cls.getName();
                if (name && !exports.includes(name)) exports.push(name);
            }
        }
    } catch (_) {}

    try {
        for (const varStmt of sourceFile.getVariableStatements()) {
            if (varStmt.isExported && varStmt.isExported()) {
                for (const decl of varStmt.getDeclarations()) {
                    const name = decl.getName();
                    if (name && !exports.includes(name)) exports.push(name);
                }
            }
        }
    } catch (_) {}

    // ── 3. ESM: export { foo, bar as baz } ──────────────────────────────────
    try {
        const exportDecls = sourceFile.getDescendantsOfKind(SyntaxKind.ExportDeclaration);
        for (const decl of exportDecls) {
            try {
                const namedExports = decl.getNamedExports();
                for (const ne of namedExports) {
                    const alias = ne.getAliasNode();
                    const name = alias ? alias.getText() : ne.getName();
                    if (name && !exports.includes(name)) exports.push(name);
                }
            } catch (_) {}
        }
    } catch (_) {}

    return exports;
}

module.exports = {
    parseExports
};