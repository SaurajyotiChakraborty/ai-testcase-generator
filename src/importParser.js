const { SyntaxKind } = require("ts-morph");

function parseImports(sourceFile) {

    const imports = [];

    /* ---------------- ES MODULE IMPORTS ---------------- */

    const importDeclarations =
        sourceFile.getImportDeclarations();

    for (const declaration of importDeclarations) {

        const moduleName =
            declaration.getModuleSpecifierValue();

        const defaultImport = declaration.getDefaultImport();
        if (defaultImport) {
            imports.push({
                importedFunction: defaultImport.getText(),
                sourceFile: moduleName,
                isDefault: true
            });
        }

        for (const namedImport of declaration.getNamedImports()) {

            imports.push({

                importedFunction:
                    namedImport.getName(),

                sourceFile:
                    moduleName,
                
                isDefault: false

            });

        }

    }

    /* ---------------- COMMONJS REQUIRE ---------------- */

    const variables =
        sourceFile.getVariableDeclarations();

    for (const variable of variables) {

        const initializer =
            variable.getInitializer();

        if (

            initializer &&
            initializer.getKind() ===
                SyntaxKind.CallExpression &&
            initializer.getExpression().getText() ===
                "require"

        ) {

            const moduleName =
                initializer
                    .getArguments()[0]
                    .getText()
                    .replace(/['"]/g, "");

            const objectBinding =
                variable.getNameNode();

            if (

                objectBinding.getKind() ===
                    SyntaxKind.ObjectBindingPattern

            ) {

                for (const element of objectBinding.getElements()) {

                    imports.push({

                        importedFunction:
                            element.getName(),

                        sourceFile:
                            moduleName

                    });

                }

            }

        }

    }

    return imports;

}

module.exports = {

    parseImports

};