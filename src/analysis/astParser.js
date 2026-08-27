const fs = require("fs");
const path = require("path");
const { Project, SyntaxKind } = require("ts-morph");

/**
 * Parses a source file into an AST result.
 * Also extracts Next.js route metadata from the file path:
 *   - routeGroup: e.g. "(dashboard)" from src/app/(dashboard)/dashboard/page.tsx
 *   - urlRoute: the public URL path, stripping route groups (parenthetical segments)
 *   - isDynamicRoute: true if path contains [param] segments
 *   - routeParams: list of [param] names
 */
function extractRouteMetadata(filePath) {
    // Normalize path separators
    const normalized = filePath.replace(/\\/g, "/");

    // Find Next.js app router segments (after /app/ or /src/app/)
    const appMatch = normalized.match(/(?:\/src)?\/app\/(.*)/);
    if (!appMatch) {
        return { routeGroup: null, urlRoute: null, isDynamicRoute: false, routeParams: [] };
    }

    const afterApp = appMatch[1]; // e.g. "(dashboard)/dashboard/page.tsx"
    const segments = afterApp.split("/");

    // Remove filename (page.tsx, layout.tsx, route.ts, etc.)
    const fileSegments = segments.slice(0, -1);

    // Extract route groups (parenthetical segments)
    const routeGroups = fileSegments.filter(s => s.startsWith("(") && s.endsWith(")"));

    // Build URL route by excluding route groups and stripping dynamic param brackets for metadata
    const urlSegments = fileSegments.filter(s => !(s.startsWith("(") && s.endsWith(")")));

    // Extract dynamic params like [userId], [id], [...slug]
    const routeParams = [];
    const urlRoute = "/" + urlSegments.map(s => {
        const dynMatch = s.match(/^\[\.{0,3}(.+)\]$/);
        if (dynMatch) {
            routeParams.push(dynMatch[1]);
            return `:${dynMatch[1]}`; // Express-style for display
        }
        return s;
    }).join("/");

    return {
        routeGroup: routeGroups.length > 0 ? routeGroups[0] : null,
        allRouteGroups: routeGroups,
        urlRoute: urlRoute === "/" ? "/" : urlRoute,
        isDynamicRoute: routeParams.length > 0,
        routeParams
    };
}

function parseAST(filePath) {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(absPath, "utf8");
    const project = new Project({
        compilerOptions: {
            allowJs: true,
            jsx: 2 // React JSX
        },
        skipAddingFilesFromTsConfig: true
    });

    let sourceFile;
    try {
        sourceFile = project.createSourceFile(absPath, content, { overwrite: true });
    } catch (e) {
        throw new Error(`AST Parse Error in ${path.basename(filePath)}: ${e.message}`);
    }

    const isUseClient = content.trim().startsWith('"use client"') || content.trim().startsWith("'use client'");
    const isUseServer = content.trim().startsWith('"use server"') || content.trim().startsWith("'use server'");

    // Extract route metadata for Next.js App Router files
    const routeMetadata = extractRouteMetadata(absPath);

    return {
        sourceFile,
        filePath: absPath,
        fileName: path.basename(absPath),
        content,
        isUseClient,
        isUseServer,
        routeMetadata
    };
}

module.exports = {
    parseAST,
    extractRouteMetadata
};
