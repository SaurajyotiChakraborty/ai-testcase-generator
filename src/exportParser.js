const { SyntaxKind } = require("ts-morph");

function parseExports(sourceFile) {

    const exports = [];

    // module.exports = { add, loginUser }

    const assignments =
        sourceFile.getDescendantsOfKind(
            SyntaxKind.BinaryExpression
        );

    for (const assignment of assignments) {

        if (
            assignment.getLeft().getText() ===
            "module.exports"
        ) {

            const right =
                assignment.getRight();

            if (
                right.getKind() ===
                SyntaxKind.ObjectLiteralExpression
            ) {

                for (const property of right.getProperties()) {

                    exports.push(
                        property.getName()
                    );
                }
            }
        }
    }

    return exports;
}

module.exports = {
    parseExports
};