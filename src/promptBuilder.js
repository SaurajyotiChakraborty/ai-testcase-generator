function buildPrompt(analysis) {

    return `
You are an expert software test engineer.

Generate comprehensive unit test cases.

Here is the project analysis:

${JSON.stringify(analysis, null, 2)}

Generate:

1. Positive test cases
2. Negative test cases
3. Edge cases
4. Exception test cases

Return only the test cases.
`;
}

/**
 * Builds a richer prompt for a specific function, utilizing framework details and depth analysis.
 * @param {object} functionAnalysis - The registry entry for a single function
 * @param {object} options - Options containing framework, etc.
 * @returns {string} The LLM prompt
 */
function buildPromptV2(functionAnalysis, options = {}) {
    const framework = options.framework || "jest";
    const isReact = options.isReact || false;
    const isNextJs = options.isNextJs || false;
    const ext = options.ext || ".js";
    const { name, file, type, body, parameters, returns, throws, conditions, controlFlow, dataFlow, complexity } = functionAnalysis;

    // Build framework specific syntax instructions
    let describeSyntax = `describe('${name} function', () => { ... })`;
    let assertSyntax = "expect(result).toBe(...)";
    
    if (framework === "mocha") {
        assertSyntax = "assert.equal(result, ...)"; // Or expect from chai
    } else if (framework === "jasmine") {
        assertSyntax = "expect(result).toEqual(...)";
    }

    let prompt = `You are an expert software test engineer writing unit tests using the **${framework}** testing framework.

> IMPORTANT: Generate tests ONLY for the \`${name}\` function shown below.
> This function was pre-selected by a smart AST analyzer as genuinely testable.
> - Do NOT generate tests for any other function, helper, or utility not shown here.
> - Do NOT write empty, placeholder, or stub test blocks.
> - Every single \`it\`/\`test\` block MUST contain a real assertion (expect/assert).
> - Focus on testing the actual logic, branches, and return values of \`${name}\`.

### Function Details
- **Name**: ${name}
- **Type**: ${type}
- **Async**: ${functionAnalysis.isAsync ? "Yes (Function is async: use `async/await` in test cases)" : "No"}
- **Parameters**: ${parameters.join(", ") || "(none)"}
- **Complexity**: ${complexity?.classification || "unknown"} (Cyclomatic: ${complexity?.cyclomatic || "?"}, LOC: ${complexity?.linesOfCode || "?"})

### Function Body
\`\`\`javascript
${body}
\`\`\`

`;

    // 1. Add Control Flow details
    if (controlFlow) {
        prompt += `### Control Flow Context\n`;
        prompt += `- There are approximately ${controlFlow.pathCount} distinct execution paths.\n`;
        if (controlFlow.branches.length > 0) {
            prompt += `- Branches to cover: ${controlFlow.branches.map(b => b.condition || b.expression).join(" | ")}\n`;
        }
        if (controlFlow.loops.length > 0) {
            prompt += `- Loops present: ${controlFlow.loops.map(l => l.type).join(", ")}\n`;
        }
        if (controlFlow.tryCatch.length > 0) {
            prompt += `- Try/Catch handling present, ensure exception paths are tested.\n`;
        }
        prompt += `\n`;
    }

    // 2. Add Data Flow details
    if (dataFlow && dataFlow.parameterUsage) {
        prompt += `### Data Flow Context\n`;
        const unused = dataFlow.parameterUsage.filter(p => !p.used).map(p => p.name);
        if (unused.length > 0) {
            prompt += `- Note: Parameters [${unused.join(", ")}] appear to be unused in the body.\n`;
        }
        prompt += `\n`;
    }

    // 3. Known Behaviors
    if (conditions.length > 0 || returns.length > 0 || throws.length > 0) {
        prompt += `### Known Behaviors Extracted via AST\n`;
        if (conditions.length > 0) prompt += `- **Conditions checked**: ${conditions.join(", ")}\n`;
        if (returns.length > 0) prompt += `- **Return values**: ${returns.join(", ")}\n`;
        if (throws.length > 0) prompt += `- **Throws**: ${throws.join(", ")}\n`;
        prompt += `\n`;
    }

    const importPath = options.relativeImport || `../src/${file.replace(/\.(js|ts|jsx|tsx)$/, "")}`;

    // 4. Dependencies
    if (functionAnalysis.dependencies && functionAnalysis.dependencies.length > 0) {
        const mockSyntax = framework === "vitest" ? "vi.mock()" :
                           framework === "mocha"   ? "sinon / proxyquire" :
                           framework === "jasmine" ? "spyOn()" : "jest.mock()";
        prompt += `### File Dependencies\n`;
        prompt += `The file imports the following dependencies. If you need to mock them using \`${mockSyntax}\`, use these EXACT paths and match the import type (default vs named):\n`;
        prompt += `Dependencies detected:\n`;
        for (const dep of functionAnalysis.dependencies) {
            let mockPath = dep.mockPath || dep.sourceFile;
            if (mockPath.startsWith('./') && !options.relativeImport) {
                mockPath = '../src/' + mockPath.substring(2);
            }
            const importType = dep.isDefault ? "Default import" : "Named import";
            prompt += `- ${importType}: \`${dep.importedFunction}\` from \`${mockPath}\`\n`;
        }
        prompt += `\n`;
    }

    let expectedImport = `{ ${name} }`;
    if (name === 'default') {
        expectedImport = 'MyComponent';
    } else if (isNextJs && (file.endsWith('page.tsx') || file.endsWith('page.js') || file.endsWith('layout.tsx') || file.endsWith('layout.js'))) {
        expectedImport = name;
    }

    // 5. Instructions
    prompt += `### Generation Instructions
1. Setup the test file correctly with imports. You MUST use \`${importPath}\` for the source file path.
   ${(ext === '.ts' || ext === '.tsx' || ext === '.jsx' || isNextJs || isReact) 
     ? `Use ES6 imports. For example:\n   \`import ${expectedImport} from '${importPath}';\`` 
     : `For example:\n   \`const { ${name} } = require('${importPath}');\``}
2. When importing or mocking any other dependencies, you MUST use the exact paths listed in the Dependencies section above. Do NOT guess paths.
3. Use standard \`${describeSyntax}\` blocks to group tests.
4. Test **positive cases** (valid inputs).
5. Test **negative cases** (invalid types, null/undefined).
6. Test **edge cases** (boundaries, empty strings/arrays, zero).
7. Test **exceptions** (ensure errors are thrown when expected). When testing exceptions with \`expect(fn).toThrow(...)\`, call \`expect(fn).toThrow(...)\` ONLY ONCE per test block to avoid executing the function multiple times.
8. Ensure all branches identified in the Control Flow Context are covered.
9. **FORMATTING**: Use the strictly formatted "Arrange, Act, Assert" (AAA) pattern for every test case. You MUST explicitly include \`// Arrange\`, \`// Act\`, and \`// Assert\` comments inside every single \`it\`/\`test\` block.
10. **FORMATTING**: Ensure the generated code is perfectly indented (4 spaces) and formatted according to standard Prettier/ESLint rules. Ensure proper spacing between blocks.
11. **LANGUAGE RULES**: You are generating a test for a \`${ext}\` file.
    ${ext === '.js' || ext === '.jsx' ? '- **CRITICAL**: Do NOT generate any TypeScript syntax (e.g. `as Type`, interfaces, type annotations). Generate ONLY valid JavaScript.' : '- You may use valid TypeScript syntax.'}
12. **JSDOM & NAVIGATION**: JSDOM blocks full page navigation and ignores \`window.location.href\` assignments (logging "Error: Not implemented: navigation"). Do NOT write tests that assert \`expect(window.location.href).toBe(...)\` or attempt to re-assign \`window.location\`. Instead, test component rendering or verify router navigation calls (e.g. \`router.push\`).
12. **SPECIAL CHARACTERS**: Correctly preserve and escape programming characters (e.g., quotes, backslashes, regex characters, string interpolation \`\${...}\`) depending on the context. Do NOT blindly escape every character.
13. Output ONLY the raw test code. Do not include markdown formatting (like \`\`\`javascript). Do not include explanations.`;

    if (isReact) {
        prompt += `\n14. **REACT**: You are testing a React project. Mock React components correctly and use standard testing-library/react practices if applicable.`;
    }
    if (isNextJs) {
        prompt += `\n15. **NEXT.JS**: You are testing a Next.js project. Handle Next.js specific imports (like next/router, next/image) correctly by mocking them as appropriate.`;
    }

    prompt += `\n\nGenerate the tests now:\n`;

    return prompt;
}

module.exports = {
    buildPrompt,
    buildPromptV2
};