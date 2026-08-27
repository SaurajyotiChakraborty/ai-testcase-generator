const fs = require("fs");
const path = require("path");
const { resolvePathAliases } = require("./aliasResolver");

/**
 * Context Builder — §7 of the architecture spec.
 *
 * Builds a three-level context package:
 *   Level 1: Target file full source + AST metadata
 *   Level 2: Direct dependency files (imported components, hooks, services, utilities)
 *   Level 3: Project configuration metadata (package.json subset, tsconfig paths, jest config)
 *
 * Rules:
 * - Never exposes secrets or API key values
 * - Does NOT convert TSX/TS/JSX to JS
 * - Does NOT recurse beyond direct imports (Level 2 only)
 * - Applies a size limit to prevent token overload
 */

const MAX_DEP_SIZE_BYTES = 8000;  // Skip single dep files over 8 KB
const MAX_TOTAL_DEP_SOURCES = 5;  // Include at most 5 Level-2 dependency sources

/**
 * Resolves an import specifier to a real file path on disk.
 * Handles:
 * - Path aliases (@/lib/api → src/lib/api.ts)
 * - Relative imports (./utils/format)
 * - Multiple possible extensions
 */
function resolveImportToFile(moduleSpecifier, sourceFileDir, projectRoot, aliases) {
    const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

    let candidate;

    if (moduleSpecifier.startsWith(".")) {
        // Relative import
        candidate = path.resolve(sourceFileDir, moduleSpecifier);
    } else {
        // Alias import — try each alias
        for (const alias of aliases) {
            const prefix = alias.alias; // e.g. "@/"
            if (moduleSpecifier.startsWith(prefix)) {
                const rest = moduleSpecifier.slice(prefix.length);
                const target = alias.target; // e.g. "src/"
                candidate = path.resolve(projectRoot, target, rest);
                break;
            }
        }
    }

    if (!candidate) return null;

    // Try as-is (exact file)
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
    }

    // Try with extensions
    for (const ext of EXTENSIONS) {
        const withExt = candidate + ext;
        if (fs.existsSync(withExt)) return withExt;
    }

    // Try as directory/index
    for (const ext of EXTENSIONS) {
        const indexPath = path.join(candidate, `index${ext}`);
        if (fs.existsSync(indexPath)) return indexPath;
    }

    return null;
}

/**
 * Read a file source safely, skipping node_modules and files exceeding the size limit.
 */
function safeReadSource(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const stat = fs.statSync(filePath);
        if (stat.size > MAX_DEP_SIZE_BYTES) return `/* [File too large to include: ${stat.size} bytes] */`;
        return fs.readFileSync(filePath, "utf8");
    } catch (e) {
        return null;
    }
}

/**
 * Read safe project metadata from package.json.
 * Strips potentially sensitive values (tokens, passwords, keys).
 */
function extractProjectMetadata(projectRoot) {
    const pkgPath = path.join(projectRoot, "package.json");
    if (!fs.existsSync(pkgPath)) return {};

    try {
        const raw = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

        // Include only useful, safe fields
        return {
            name: raw.name,
            type: raw.type || "commonjs",
            dependencies: Object.keys(raw.dependencies || {}),
            devDependencies: Object.keys(raw.devDependencies || {}),
            scripts: raw.scripts || {},
            jest: raw.jest ? "defined-in-package-json" : undefined
        };
    } catch (e) {
        return {};
    }
}

/**
 * Read the project's Jest configuration summary safely.
 */
function extractJestConfigSummary(projectRoot) {
    const candidates = [
        "jest.config.js", "jest.config.cjs", "jest.config.mjs",
        "jest.config.ts", "jest.config.json"
    ];

    for (const c of candidates) {
        const fullPath = path.join(projectRoot, c);
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, "utf8");
            // Return filename + first 500 chars (safe summary)
            return { file: c, summary: content.slice(0, 500) };
        }
    }
    return null;
}

/**
 * Build a full context package for a source file.
 *
 * @param {object} astResult - Result from parseAST()
 * @param {object} extractedData - Result from extractExports()
 * @param {string} projectRoot
 * @returns {ContextPackage}
 */
function buildContext(astResult, extractedData, projectRoot) {
    const sourceFileDir = path.dirname(astResult.filePath);
    const { aliases } = resolvePathAliases(projectRoot);

    // ── Level 1: Target ──────────────────────────────────────────────
    const level1 = {
        filePath: astResult.filePath,
        fileName: astResult.fileName,
        source: astResult.content,
        routeMetadata: astResult.routeMetadata || null
    };

    // ── Level 2: Direct Dependencies ─────────────────────────────────
    const level2 = [];
    const seen = new Set([astResult.filePath]);
    let depCount = 0;

    for (const imp of extractedData.imports) {
        if (depCount >= MAX_TOTAL_DEP_SOURCES) break;

        const specifier = imp.moduleSpecifier;

        // Skip third-party packages (not local files)
        const isLocal = specifier.startsWith(".") || aliases.some(a => specifier.startsWith(a.alias));
        if (!isLocal) continue;

        const resolvedPath = resolveImportToFile(specifier, sourceFileDir, projectRoot, aliases);
        if (!resolvedPath || seen.has(resolvedPath)) continue;

        // Skip node_modules
        if (resolvedPath.includes("node_modules")) continue;

        seen.add(resolvedPath);

        const source = safeReadSource(resolvedPath);
        if (!source) continue;

        level2.push({
            originalImport: specifier,
            resolvedPath: path.relative(projectRoot, resolvedPath).replace(/\\/g, "/"),
            fileName: path.basename(resolvedPath),
            extension: path.extname(resolvedPath),
            source
        });
        depCount++;
    }

    // ── Level 3: Project Configuration ───────────────────────────────
    const level3 = {
        projectMetadata: extractProjectMetadata(projectRoot),
        jestConfig: extractJestConfigSummary(projectRoot),
        tsconfigPaths: resolvePathAliases(projectRoot).aliases
    };

    return {
        level1,
        level2,
        level3,
        summary: {
            targetFile: astResult.fileName,
            extension: path.extname(astResult.fileName),
            directDepsIncluded: level2.length,
            hasRouteMetadata: !!astResult.routeMetadata?.urlRoute
        }
    };
}

module.exports = {
    buildContext,
    resolveImportToFile
};
