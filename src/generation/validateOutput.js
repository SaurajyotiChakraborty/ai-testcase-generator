const { Project } = require("ts-morph");

function cleanMarkdownFences(rawCode) {
    let cleaned = rawCode.trim();
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "");
    }
    if (cleaned.endsWith("```")) {
        cleaned = cleaned.replace(/\n?```$/, "");
    }
    return cleaned.trim();
}

// ── Quality Gate — §20 ───────────────────────────────────────────────────────

/**
 * Detects if the generated code contains likely API key or secret values.
 * Patterns: long hex/base64 strings, common env var names assigned inline.
 */
function containsSecrets(code) {
    const secretPatterns = [
        /['"`][A-Za-z0-9+/]{32,}['"`]/,                 // long base64/hex strings
        /API_KEY\s*=\s*['"`][^'"`]+['"`]/i,             // API_KEY = "..."
        /SECRET\s*=\s*['"`][^'"`]+['"`]/i,              // SECRET = "..."
        /sk-[A-Za-z0-9]{20,}/,                          // OpenAI key pattern
        /AIza[A-Za-z0-9_-]{35}/                         // Google API key pattern
    ];
    return secretPatterns.some(p => p.test(code));
}

/**
 * Detects style-only assertions that check Tailwind/CSS classes rather than behavior.
 * Examples: toHaveClass('bg-blue-500'), toHaveClass('text-sm p-4')
 */
function hasStyleOnlyAssertions(code) {
    // Tailwind utility class patterns inside toHaveClass()
    const stylePattern = /toHaveClass\s*\(\s*['"`][^'"`]*(?:bg-|text-|p-|m-|px-|py-|mx-|my-|flex|grid|rounded|font-|w-|h-|border-|shadow-|gap-|items-|justify-)[^'"`]*['"`]/g;
    return stylePattern.test(code);
}

/**
 * Detects generic, meaningless test names that violate §15.
 */
const GENERIC_NAME_PATTERNS = [
    /^\s*it\s*\(\s*['"`]test\d*['"`]/m,           // it('test1'), it('test2')
    /^\s*it\s*\(\s*['"`]works['"`]/im,             // it('works')
    /^\s*it\s*\(\s*['"`]button test['"`]/im,       // it('button test')
    /^\s*it\s*\(\s*['"`]AI test['"`]/im,           // it('AI test')
    /^\s*it\s*\(\s*['"`]component test['"`]/im,    // it('component test')
    /^\s*it\s*\(\s*['"`]renders['"`]\s*,/im,       // it('renders', ...) — too vague alone
    /^\s*test\s*\(\s*['"`]test\d*['"`]/m,          // test('test1')
];

function hasGenericTestNames(code) {
    return GENERIC_NAME_PATTERNS.some(p => p.test(code));
}

/**
 * Detects if the generated code has duplicate test/it block names.
 */
function hasDuplicateTestNames(code) {
    const nameRegex = /(?:it|test)\s*\(\s*(['"`])((?:(?!\1).)*)\1/g;
    const names = new Set();
    let match;
    while ((match = nameRegex.exec(code)) !== null) {
        const name = match[2].trim().toLowerCase();
        if (names.has(name)) return true;
        names.add(name);
    }
    return false;
}

/**
 * Detects dangerous Node.js patterns that should never appear in generated tests.
 * Blocks: eval, exec, spawn, child_process, fs.writeFileSync, arbitrary file writes,
 * credential/env access, network requests that bypass the test runner.
 */
const DANGEROUS_PATTERNS = [
    // eval / Function constructor
    { pattern: /\beval\s*\(/, label: 'eval()' },
    { pattern: /new\s+Function\s*\(/, label: 'new Function()' },
    // child_process
    { pattern: /require\s*\(\s*['"`]child_process['"`]\s*\)/, label: "require('child_process')" },
    { pattern: /\bexecSync\s*\(/, label: 'execSync()' },
    { pattern: /\bspawnSync\s*\(/, label: 'spawnSync()' },
    { pattern: /\bexecFileSync\s*\(/, label: 'execFileSync()' },
    // Dangerous fs operations — writes/deletes
    { pattern: /\bfs\.writeFileSync\s*\(/, label: 'fs.writeFileSync()' },
    { pattern: /\bfs\.unlinkSync\s*\(/, label: 'fs.unlinkSync()' },
    { pattern: /\bfs\.rmdirSync\s*\(/, label: 'fs.rmdirSync()' },
    { pattern: /\bfs\.rmSync\s*\(/, label: 'fs.rmSync()' },
    // process.env dumping
    { pattern: /JSON\.stringify\s*\(\s*process\.env\s*\)/, label: 'JSON.stringify(process.env)' },
    // Credential/env key access for secrets
    { pattern: /process\.env\.(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|ACCESS_KEY)\b/, label: 'process.env secret access' },
];

function hasDangerousPatterns(code) {
    const found = [];
    for (const { pattern, label } of DANGEROUS_PATTERNS) {
        if (pattern.test(code)) found.push(label);
    }
    return found;
}

/**
 * Full quality gate check — runs all §20 checks.
 * Returns an array of quality issues found (empty = passed).
 */
function runQualityGate(code, sourceExt) {
    const issues = [];

    if (containsSecrets(code)) {
        issues.push("SECURITY: Generated test appears to contain hardcoded API keys or secrets.");
    }

    const dangerous = hasDangerousPatterns(code);
    if (dangerous.length > 0) {
        issues.push(`SECURITY: Generated test contains dangerous patterns that must not run in tests: ${dangerous.join(', ')}.`);
    }

    if (hasStyleOnlyAssertions(code)) {
        issues.push("QUALITY: Generated test contains style-only assertions (Tailwind class checks). Tests should focus on behavior, not CSS classes.");
    }

    if (hasGenericTestNames(code)) {
        issues.push("QUALITY: Generated test contains generic or meaningless test names (e.g. 'test1', 'works', 'button test'). Test names must describe behavior.");
    }

    if (hasDuplicateTestNames(code)) {
        issues.push("QUALITY: Generated test contains duplicate test/it block names.");
    }

    return issues;
}


// ── Main Validator ────────────────────────────────────────────────────────────

function validateGeneratedCode(rawCode, extractedData) {
    const cleanedCode = cleanMarkdownFences(rawCode);

    // 1. Syntax Check via ts-morph AST parser
    const project = new Project({
        compilerOptions: { allowJs: true, jsx: 2 },
        skipAddingFilesFromTsConfig: true
    });

    let sourceFile;
    try {
        sourceFile = project.createSourceFile("temp_val.tsx", cleanedCode, { overwrite: true });

        // getSyntacticDiagnostics lives on the Project's program, not on SourceFile in ts-morph
        const diagnostics = project.getProgram().getSyntacticDiagnostics(sourceFile);
        if (diagnostics.length > 0) {
            const errorText = diagnostics.slice(0, 3).map(d => {
                const msg = d.getMessageText();
                return typeof msg === "string" ? msg : msg.getMessageText();
            }).join(" | ");
            return {
                isValid: false,
                error: `Syntax Error (truncated or invalid code): ${errorText}`,
                code: cleanedCode
            };
        }
    } catch (e) {
        return { isValid: false, error: `Syntax Error: ${e.message}`, code: cleanedCode };
    }

    // 2. Cross-check imported exports against confirmed exports (hallucination check)
    const exportsSet = new Set(extractedData.exports.map(e => e.name));
    const hasDefaultExport = extractedData.exports.some(e => e.isDefault);

    for (const decl of sourceFile.getImportDeclarations()) {
        const moduleSpecifier = decl.getModuleSpecifierValue();
        const baseFileName = extractedData.fileName.replace(/\.[^/.]+$/, "");

        if (moduleSpecifier.includes(baseFileName)) {
            const defaultImport = decl.getDefaultImport()?.getText();
            if (defaultImport && !hasDefaultExport) {
                return {
                    isValid: false,
                    error: `Hallucinated Default Import: test imported default '${defaultImport}' but ${extractedData.fileName} has no default export.`,
                    code: cleanedCode
                };
            }

            const namedImports = decl.getNamedImports().map(n => n.getName());
            for (const imp of namedImports) {
                if (!exportsSet.has(imp)) {
                    return {
                        isValid: false,
                        error: `Hallucinated Import: test imported '${imp}' which is not exported by ${extractedData.fileName}.`,
                        code: cleanedCode
                    };
                }
            }
        }
    }

    // 3. Quality Gate §20
    const sourceExt = extractedData.fileName.match(/\.[^/.]+$|$/)[0];
    const qualityIssues = runQualityGate(cleanedCode, sourceExt);
    if (qualityIssues.length > 0) {
        // Quality issues are warnings — log them but don't block the file
        return {
            isValid: true,
            code: cleanedCode,
            qualityWarnings: qualityIssues
        };
    }

    return { isValid: true, code: cleanedCode, qualityWarnings: [] };
}

module.exports = {
    cleanMarkdownFences,
    validateGeneratedCode,
    runQualityGate
};
