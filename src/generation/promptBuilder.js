const fs = require("fs");
const path = require("path");
const { resolvePathAliases } = require("../analysis/aliasResolver");

const TEMPLATES_DIR = path.resolve(__dirname, "../../templates/prompts");

function readTemplate(name) {
    return fs.readFileSync(path.join(TEMPLATES_DIR, name), "utf8");
}

/**
 * Selects the correct prompt template based on:
 * - Test runner (jest, vitest, mocha)
 * - Source file extension (.js/.ts → plain, .jsx/.tsx → react/component)
 * - Framework (Next.js app router client/server, API routes)
 * - Export type (React hook vs component vs plain function)
 *
 * No project-specific hardcoding. No framework assumptions beyond what is detected.
 */
function getPromptTemplate(frameworkInfo, extractedData, testRunner, sourceExt) {
    const isJSX = sourceExt === ".jsx" || sourceExt === ".tsx";
    const hasJSX = isJSX || extractedData.jsxElements.length > 0;
    const isHook = extractedData.fileName.startsWith("use") ||
        extractedData.exports.some(e => e.name.startsWith("use"));

    // --- Vitest ---
    if (testRunner === "vitest") {
        if ((frameworkInfo.isReact || hasJSX) && !isHook) {
            return readTemplate("vitest-react-component.md");
        }
        return readTemplate("vitest-plain-module.md");
    }

    // --- Mocha ---
    if (testRunner === "mocha") {
        if (frameworkInfo.isReact || hasJSX) {
            return readTemplate("mocha-react-component.md");
        }
        return readTemplate("mocha-plain-module.md");
    }

    // --- Jest (default) ---
    if (frameworkInfo.isNextJs) {
        // API route files
        if (extractedData.fileName.includes("route.ts") || extractedData.fileName.includes("route.js")) {
            return readTemplate("nextjs-api-route.md");
        }
        // App router server components (no 'use client')
        if (frameworkInfo.isAppRouter && !extractedData.isUseClient) {
            return readTemplate("nextjs-app-router-server.md");
        }
        // App router client components ('use client')
        if (extractedData.isUseClient) {
            return readTemplate("nextjs-app-router-client.md");
        }
        // Pages router or generic Next.js component
        if (hasJSX) {
            return readTemplate("nextjs-app-router-client.md");
        }
    }

    // React hooks (any framework)
    if (isHook) {
        return readTemplate("hook.md");
    }

    // React component (.jsx / .tsx or has JSX elements)
    if (hasJSX || frameworkInfo.isReact) {
        return readTemplate("react-component.md");
    }

    // Plain JS/TS module (.js / .ts without JSX)
    return readTemplate("plain-ts-module.md");
}

/**
 * Determines whether the test runner uses Jest-style APIs (jest.fn, jest.mock)
 * or Vitest-style APIs (vi.fn, vi.mock) for prompt environment rule generation.
 */
function getRunnerApiStyle(testRunner) {
    if (testRunner === "vitest") return "vitest";
    if (testRunner === "mocha") return "mocha";
    return "jest";
}

/**
 * Compute the correct relative import path and alias import path
 * from the generated test file back to the original source file.
 */
function computeImportPath(sourceFilePath, outputDir, projectRoot) {
    const absSource = path.resolve(sourceFilePath);
    const absRoot = path.resolve(projectRoot);

    let relSourceFromRoot = path.relative(absRoot, absSource).replace(/\\/g, "/");
    if (relSourceFromRoot.startsWith("..")) {
        relSourceFromRoot = path.basename(absSource);
    }

    const { aliases } = resolvePathAliases(projectRoot);
    let aliasPath = null;

    if (aliases && aliases.length > 0) {
        for (const a of aliases) {
            const cleanTarget = a.target;
            if (cleanTarget && relSourceFromRoot.startsWith(cleanTarget)) {
                aliasPath = `${a.alias}${relSourceFromRoot.replace(cleanTarget, "").replace(/\.(tsx|ts|jsx|js)$/, "")}`;
                break;
            } else if (!cleanTarget) {
                aliasPath = `${a.alias}${relSourceFromRoot.replace(/\.(tsx|ts|jsx|js)$/, "")}`;
                break;
            }
        }
    }

    if (!aliasPath) {
        if (relSourceFromRoot.startsWith("src/")) {
            aliasPath = `@/${relSourceFromRoot.replace(/^src\//, "").replace(/\.(tsx|ts|jsx|js)$/, "")}`;
        } else if (relSourceFromRoot.startsWith("app/")) {
            aliasPath = `@/${relSourceFromRoot.replace(/\.(tsx|ts|jsx|js)$/, "")}`;
        }
    }

    const ext = path.extname(relSourceFromRoot);
    const testRelPath = relSourceFromRoot.replace(new RegExp(ext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), `.test${ext}`);
    const absTestFile = path.join(path.resolve(outputDir), testRelPath);

    let importRel = path.relative(path.dirname(absTestFile), absSource).replace(/\\/g, "/");
    if (!importRel.startsWith(".")) {
        importRel = "./" + importRel;
    }
    importRel = importRel.replace(/\.(tsx|ts|jsx|js)$/, "");

    return { relativePath: importRel, aliasPath };
}

function buildGroundedPrompt(astResult, extractedData, frameworkInfo, options = {}) {
    const testRunner = options.testRunner || "jest";
    const projectRoot = options.projectRoot || process.cwd();
    const outputDir = options.outputDir || "generated-tests";
    const sourceExt = path.extname(extractedData.fileName);
    const apiStyle = getRunnerApiStyle(testRunner);
    const contextPackage = options.contextPackage || null;

    const template = getPromptTemplate(frameworkInfo, extractedData, testRunner, sourceExt);
    const { relativePath, aliasPath } = computeImportPath(astResult.filePath, outputDir, projectRoot);
    const primaryImportPath = aliasPath || relativePath;

    // Determine correct import syntax from AST exports
    const defaultExport = extractedData.exports.find(e => e.isDefault);
    const namedExports = extractedData.exports.filter(e => !e.isDefault);

    // Build component/function name from filename or parent dir
    let componentName = extractedData.fileName.replace(/\.(tsx|ts|jsx|js)$/, "").replace(/[^a-zA-Z0-9]/g, "");
    if (!componentName || componentName.toLowerCase() === "page" || componentName.toLowerCase() === "index") {
        const dirParts = astResult.filePath.replace(/\\/g, "/").split("/");
        const parentDir = dirParts[dirParts.length - 2] || "TargetComponent";
        componentName = parentDir.replace(/[^a-zA-Z0-9]/g, "") + "Page";
    }
    const capitalName = componentName.charAt(0).toUpperCase() + componentName.slice(1);

    let importExample = "";
    if (defaultExport && namedExports.length > 0) {
        importExample += `import ${capitalName}, { ${namedExports.map(e => e.name).join(", ")} } from '${primaryImportPath}';\n`;
    } else if (defaultExport) {
        importExample += `import ${capitalName} from '${primaryImportPath}';\n`;
    } else if (namedExports.length > 0) {
        importExample += `import { ${namedExports.map(e => e.name).join(", ")} } from '${primaryImportPath}';\n`;
    }

    // Collect hooks that must be mocked
    const thirdPartyHooks = extractedData.imports
        .filter(imp => imp.isThirdParty)
        .flatMap(imp => imp.namedImports.filter(n => n.name.startsWith("use")).map(n => ({
            hook: n.name, module: imp.moduleSpecifier
        })));
    const localHooks = extractedData.imports
        .filter(imp => !imp.isThirdParty)
        .flatMap(imp => imp.namedImports.filter(n => n.name.startsWith("use")).map(n => ({
            hook: n.name, module: imp.moduleSpecifier
        })));
    const allHookMocks = [...thirdPartyHooks, ...localHooks];

    const mockFn = apiStyle === "vitest" ? "vi.fn()" : "jest.fn()";
    const mockModule = apiStyle === "vitest" ? "vi.mock" : "jest.mock";

    let hookMockInstructions = "";
    if (allHookMocks.length > 0) {
        hookMockInstructions = `\n### MANDATORY Hook Mocks
You MUST mock ALL of the following hooks at the top of the file (before any describe block):
${allHookMocks.map(h => `- \`${mockModule}('${h.module}', () => ({ ${h.hook}: ${mockFn} }))\``).join("\n")}
`;
    }

    const systemPrompt = `You are a world-class test automation engineer. Generate unit tests using **${testRunner}**.\n\n${template}`;

    // Build runner-specific environment rules
    const isJSX = sourceExt === ".jsx" || sourceExt === ".tsx";
    const hasJSX = isJSX || extractedData.jsxElements.length > 0;

    let envRules = "";
    if (testRunner === "jest") {
        envRules = `### JEST ENVIRONMENT RULES (CRITICAL)
1. \`@testing-library/jest-dom\` matchers (\`toBeInTheDocument()\`, \`toHaveClass()\`, \`toHaveTextContent()\`, \`toBeVisible()\`, \`toBeDisabled()\`) are globally configured. Use them — DO NOT replace with \`toBeTruthy()\`.
2. STRICT PROHIBITION: NEVER delete, redefine, or reassign \`window.location\`. Mock \`useRouter\` / \`usePathname\` instead.
3. Use \`jest.fn()\` for mocking, \`jest.spyOn()\` for spies, \`jest.useFakeTimers()\` for timers.
4. Mock external APIs/fetch calls for success, failure (network errors, 4xx/5xx), loading, and empty states.
5. Spy on \`console.error\` in negative test cases: \`const spy = jest.spyOn(console, 'error').mockImplementation(() => {}); ... spy.mockRestore();\``;
    } else if (testRunner === "vitest") {
        envRules = `### VITEST ENVIRONMENT RULES (CRITICAL)
1. Import test APIs from \`vitest\`: \`import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'\`.
2. \`@testing-library/jest-dom\` matchers are globally configured. Use \`toBeInTheDocument()\`, \`toHaveClass()\`, etc.
3. Use \`vi.fn()\` for mocking, \`vi.spyOn()\` for spies, \`vi.useFakeTimers()\` for timers.
4. Use \`vi.mock('module-name', ...)\` — NOT \`jest.mock\`.
5. STRICT PROHIBITION: NEVER delete, redefine, or reassign \`window.location\`.`;
    } else if (testRunner === "mocha") {
        envRules = `### MOCHA ENVIRONMENT RULES (CRITICAL)
1. Use Mocha lifecycle hooks: \`before()\`, \`after()\`, \`beforeEach()\`, \`afterEach()\`.
2. Use Chai BDD assertions: \`expect(value).to.equal(...)\`, \`expect(value).to.deep.equal(...)\`, \`expect(fn).to.throw(...)\`.
3. Do NOT use \`jest.fn()\`, \`vi.fn()\`, or any Jest/Vitest APIs.
4. For stubs/spies, use \`sinon\` if available in the project, otherwise create manual mock objects.`;
    }

    const standardRules = hasJSX ? `### STANDARD TEST RULES
1. Focus on testing component rendering, user interactions, and business logic.
2. Use \`screen.getByRole\`, \`screen.getByText\`, \`screen.getByLabelText\` for queries.
3. Wrap state-changing actions in \`act()\` or use \`await waitFor()\`.
4. Each test must be isolated and clean up properly in \`afterEach()\`.` :
    `### STANDARD TEST RULES
1. Test exported functions and classes with a range of inputs: normal, edge cases, errors.
2. Each test must be isolated and not depend on shared mutable state.
3. Test thrown errors explicitly when the function documents that it can throw.`;

    // Build route metadata section (§4 — Next.js route groups)
    let routeSection = "";
    if (contextPackage?.level1?.routeMetadata?.urlRoute) {
        const rm = contextPackage.level1.routeMetadata;
        routeSection = `\n### Next.js Route Information
- **File System Path**: ${astResult.filePath.replace(/\\/g, "/")}
- **Route Group**: ${rm.routeGroup || "(none)"} — this is a filesystem-only grouping, NOT part of the public URL
- **Public URL Route**: ${rm.urlRoute}
- **Is Dynamic Route**: ${rm.isDynamicRoute ? `Yes — params: [${rm.routeParams.join(", ")}]` : "No"}
`;
    }

    // Build Level-2 dependency context section (§7)
    let depContext = "";
    if (contextPackage?.level2 && contextPackage.level2.length > 0) {
        const depParts = contextPackage.level2.map(dep => {
            return `#### ${dep.fileName} (imported as \`${dep.originalImport}\` → \`${dep.resolvedPath}\`)
\`\`\`${dep.extension.replace(".", "")}
${dep.source}
\`\`\``;
        }).join("\n\n");
        depContext = `\n### Direct Dependency Sources (for context — do NOT import from these paths directly)
These are the actual source files imported by the target. Use them to understand what APIs, hooks, and functions are available and how to mock them correctly:

${depParts}
`;
    }

    const userPrompt = `### Source Code Grounding Context
- **File Name**: ${extractedData.fileName}
- **Source Extension**: ${sourceExt} (test file MUST use \`.test${sourceExt}\` extension)
- **Test Runner**: ${testRunner}
- **Primary Import Path**: \`${primaryImportPath}\`
- **Fallback Import Path**: \`${relativePath}\`
- **Is Next.js Client Component**: ${extractedData.isUseClient ? "Yes ('use client')" : "No"}
- **Is Next.js Server Component**: ${extractedData.isUseServer ? "Yes ('use server')" : "No"}
- **Has JSX**: ${hasJSX ? "Yes" : "No"}
${routeSection}
### CRITICAL IMPORT RULES (DO NOT TRUNCATE OR ALTER THIS PATH)
You MUST use EXACTLY this import statement in your test file:
\`\`\`typescript
${importExample}\`\`\`
Do NOT change, truncate, or shorten the module specifier path '${primaryImportPath}'.

### Confirmed Exports
${JSON.stringify(extractedData.exports, null, 2)}

### Confirmed Imports & Dependencies
${JSON.stringify(extractedData.imports, null, 2)}

### Hooks & JSX Elements
- **Hooks Used**: ${extractedData.hooksUsed.join(", ") || "(none)"}
- **JSX Tags**: ${extractedData.jsxElements.join(", ") || "(none)"}
${hookMockInstructions}${depContext}
${envRules}

${standardRules}

### TEST NAME QUALITY RULES (MANDATORY — §15)
Every \`it(...)\` and \`test(...)\` block name MUST describe behavior. Examples:
✅ 'should render the sign-in form'
✅ 'should reject an invalid email address'
✅ 'should display an error when the API fails'
❌ 'test1', 'test2', 'works', 'button test', 'renders'

### Raw Source File Code
\`\`\`typescript
${astResult.content}
\`\`\`

Generate a complete, syntactically valid test file. Output ONLY raw executable test code. No markdown fences. No commentary.
`;

    return { systemPrompt, userPrompt };
}

module.exports = {
    buildGroundedPrompt,
    computeImportPath
};
