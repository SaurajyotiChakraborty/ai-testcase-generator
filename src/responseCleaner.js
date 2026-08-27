/**
 * Cleans the AI response and extracts the source code.
 * Removes markdown fences, explanations, and surrounding text.
 * 
 * @param {string} text - The raw text response from the AI.
 * @param {string} ext - The target file extension to guide extraction.
 * @returns {string} The cleaned code string.
 */
function extractCodeBlock(text, ext) {
    if (!text) return "";

    // If there are Markdown fences, extract the first one
    const codeBlockRegex = /```[a-zA-Z]*\n([\s\S]*?)\n```/;
    const match = text.match(codeBlockRegex);

    if (match && match[1]) {
        return match[1].trim();
    }

    // Fallback: strip any partial markdown fences and return raw text
    let cleaned = text.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
    return cleaned;
}

module.exports = {
    extractCodeBlock
};
