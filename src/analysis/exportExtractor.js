const { SyntaxKind } = require("ts-morph");

function extractExports(astResult) {
    const { sourceFile, isUseClient, isUseServer } = astResult;
    const exportsList = [];
    const importsList = [];
    const hooksUsed = new Set();
    const jsxElements = new Set();

    // 1. Extract Imports
    for (const decl of sourceFile.getImportDeclarations()) {
        const moduleSpecifier = decl.getModuleSpecifierValue();
        const defaultImport = decl.getDefaultImport()?.getText();
        const namedImports = decl.getNamedImports().map(n => ({
            name: n.getName(),
            alias: n.getAliasNode()?.getText()
        }));

        importsList.push({
            moduleSpecifier,
            defaultImport,
            namedImports,
            isThirdParty: !moduleSpecifier.startsWith(".") && !moduleSpecifier.startsWith("@/")
        });

        // Track standard React / Next hooks
        namedImports.forEach(imp => {
            if (imp.name.startsWith("use")) hooksUsed.add(imp.name);
        });
        if (defaultImport && defaultImport.startsWith("use")) hooksUsed.add(defaultImport);
    }

    // 2. Extract Exports (Named & Default)
    const exportSymbols = sourceFile.getExportedDeclarations();
    for (const [name, decls] of exportSymbols) {
        for (const decl of decls) {
            const isDefault = name === "default";
            let kind = "unknown";
            let parameters = [];
            let propTypes = [];

            if (decl.getKind() === SyntaxKind.FunctionDeclaration || decl.getKind() === SyntaxKind.FunctionExpression || decl.getKind() === SyntaxKind.ArrowFunction) {
                kind = "function";
                if (decl.getParameters) {
                    parameters = decl.getParameters().map(p => ({
                        name: p.getName(),
                        type: p.getType()?.getText() || "any",
                        hasDefault: !!p.getInitializer()
                    }));
                }
            } else if (decl.getKind() === SyntaxKind.VariableDeclaration) {
                kind = "variable";
            } else if (decl.getKind() === SyntaxKind.ClassDeclaration) {
                kind = "class";
            }

            exportsList.push({
                name,
                isDefault,
                kind,
                parameters,
                propTypes
            });
        }
    }

    // 3. Extract JSX Interactive Elements & TestIDs
    sourceFile.forEachDescendant(node => {
        if (node.getKind() === SyntaxKind.JsxOpeningElement || node.getKind() === SyntaxKind.JsxSelfClosingElement) {
            const tagName = node.getTagNameNode().getText();
            jsxElements.add(tagName);
        }
    });

    return {
        fileName: astResult.fileName,
        exports: exportsList,
        imports: importsList,
        hooksUsed: Array.from(hooksUsed),
        jsxElements: Array.from(jsxElements),
        isUseClient,
        isUseServer
    };
}

module.exports = {
    extractExports
};
