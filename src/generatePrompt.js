const { readAnalysis } = require("./readAnalysis");
const { buildPrompt } = require("./promptBuilder");

const analysis = readAnalysis();

const prompt = buildPrompt(analysis);

console.log(prompt);