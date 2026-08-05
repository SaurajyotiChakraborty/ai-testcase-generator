const { registry } = require("./functionRegistry");
const { buildPrompt } = require("./promptBuilder");

const prompt = buildPrompt(registry);

console.log(prompt);