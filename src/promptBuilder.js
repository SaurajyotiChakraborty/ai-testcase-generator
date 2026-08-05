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

module.exports = {
    buildPrompt
};