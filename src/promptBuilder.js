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

Your task is to generate comprehensive unit tests for the \`${name}\` function located in \`${file}\`.

### Function Details
- **Name**: ${name}
- **Type**: ${type}
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

    // 4. Instructions
    prompt += `### Generation Instructions
1. Setup the test file correctly with imports. For example:
   \`const { ${name} } = require('../src/${file.replace(/\.js$/, "")}');\`
2. Use standard \`${describeSyntax}\` blocks to group tests.
3. Test **positive cases** (valid inputs).
4. Test **negative cases** (invalid types, null/undefined).
5. Test **edge cases** (boundaries, empty strings/arrays, zero).
6. Test **exceptions** (ensure errors are thrown when expected).
7. Ensure all branches identified in the Control Flow Context are covered.
8. **FORMATTING**: Use the strictly formatted "Arrange, Act, Assert" (AAA) pattern for every test case. You MUST explicitly include \`// Arrange\`, \`// Act\`, and \`// Assert\` comments inside every single \`it\`/\`test\` block.
9. **FORMATTING**: Ensure the generated code is perfectly indented (4 spaces) and formatted according to standard Prettier/ESLint rules. Ensure proper spacing between blocks.
10. Output ONLY the raw JavaScript test code. Do not include markdown formatting (like \`\`\`javascript). Do not include explanations.

Generate the tests now:
`;

    return prompt;
}

module.exports = {
    buildPrompt,
    buildPromptV2
};