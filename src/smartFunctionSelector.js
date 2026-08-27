const chalk = require("chalk");

/**
 * Patterns for function names that are almost never worth unit-testing.
 * These are either trivial pass-throughs, side-effect-only loggers, or lifecycle hooks.
 */
const TRIVIAL_NAME_PATTERNS = [
    /^log$/i,
    /^logger$/i,
    /^debug$/i,
    /^warn$/i,
    /^info$/i,
    /^print$/i,
    /^noop$/i,
    /^noOp$/i,
    /^stub$/i,
    /^mock$/i,
    /^setup$/i,
    /^teardown$/i,
    /^beforeAll$/i,
    /^afterAll$/i,
    /^beforeEach$/i,
    /^afterEach$/i,
    /^main$/i,
    /^run$/i,          // top-level runners — usually just call other things
    /^start$/i,
    /^init$/i,
    /^bootstrap$/i,
    /^cleanup$/i
];

/**
 * Patterns for function bodies that indicate a trivial function.
 * Match against the trimmed body text.
 */
const TRIVIAL_BODY_PATTERNS = [
    /^console\.(log|warn|error|info|debug)\s*\(/,  // just a console call
    /^return\s+(null|undefined|true|false|[\d.]+|['"`][^'"`]*['"`])\s*;?$/, // literal return
    /^\{\s*\}\s*$/, // empty body
    /^return\s*;\s*$/ // bare return
];

/**
 * Scores a single function for "testability".
 * Higher score = more worth testing.
 *
 * Scoring criteria:
 *  +10 — Is exported (part of public API)
 *  +8  — Has throw statements (error-handling paths to test)
 *  +5  — Has 2+ conditions/branches
 *  +4  — Has 3+ distinct control-flow paths
 *  +3  — Cyclomatic complexity >= 3
 *  +2  — Has parameters that are actually used
 *  +2  — Is async (async paths need await testing)
 *  +1  — Has return values
 *  -10 — Name matches a trivial pattern
 *  -10 — Body is trivially short (< 3 meaningful lines)
 *  -8  — Body matches a trivial body pattern
 *  -5  — Has 0 parameters AND 0 branches AND complexity <= 1
 *
 * Functions with score < 3 are filtered out.
 */
function scoreFunction(func) {
    let score = 0;
    const reasons = [];

    const bodyText = (func.body || "").trim();
    const bodyLines = bodyText.split("\n").filter(l => l.trim().length > 0);
    const name = func.name || "";
    const complexity = func.complexity || {};
    const controlFlow = func.controlFlow || {};
    const dataFlow = func.dataFlow || {};

    // ── Positive signals ──────────────────────────────────────────────────

    if (func.exports === true) {
        score += 10;
        reasons.push("exported (public API)");
    }

    if (func.throws && func.throws.length > 0) {
        score += 8;
        reasons.push(`throws ${func.throws.length} error(s)`);
    }

    if (func.conditions && func.conditions.length >= 2) {
        score += 5;
        reasons.push(`${func.conditions.length} conditions`);
    } else if (func.conditions && func.conditions.length === 1) {
        score += 2;
        reasons.push("1 condition");
    }

    // pathCount > 100 usually means exponential branching — not meaningful
    if (controlFlow.pathCount && controlFlow.pathCount >= 3 && controlFlow.pathCount <= 100) {
        score += 4;
        reasons.push(`${controlFlow.pathCount} execution paths`);
    } else if (controlFlow.pathCount && controlFlow.pathCount === 2) {
        score += 2;
        reasons.push("2 execution paths");
    }

    if (complexity.cyclomatic && complexity.cyclomatic >= 3) {
        score += 3;
        reasons.push(`cyclomatic complexity ${complexity.cyclomatic}`);
    } else if (complexity.cyclomatic && complexity.cyclomatic === 2) {
        score += 1;
        reasons.push("cyclomatic complexity 2");
    }

    const usedParams = (dataFlow.parameterUsage || []).filter(p => p.used);
    if (usedParams.length > 0 && func.parameters && func.parameters.length > 0) {
        score += 2;
        reasons.push(`${usedParams.length} used parameter(s)`);
    }

    if (func.isAsync) {
        score += 2;
        reasons.push("async function");
    }

    if (func.returns && func.returns.length > 0) {
        score += 1;
        reasons.push("has return values");
    }

    // ── Negative signals ──────────────────────────────────────────────────

    const isTrivialName = TRIVIAL_NAME_PATTERNS.some(p => p.test(name));
    if (isTrivialName) {
        score -= 10;
        reasons.push(`trivial name pattern ("${name}")`);
    }

    if (bodyLines.length < 3) {
        score -= 10;
        reasons.push(`trivial body (${bodyLines.length} lines)`);
    }

    const isTrivialBody = TRIVIAL_BODY_PATTERNS.some(p => p.test(bodyText));
    if (isTrivialBody) {
        score -= 8;
        reasons.push("trivial body pattern");
    }

    const hasNoParams = !func.parameters || func.parameters.length === 0;
    const hasNoBranches = !func.conditions || func.conditions.length === 0;
    const isLowComplexity = !complexity.cyclomatic || complexity.cyclomatic <= 1;
    if (hasNoParams && hasNoBranches && isLowComplexity) {
        score -= 5;
        reasons.push("no params, no branches, low complexity");
    }

    return { score, reasons };
}

/**
 * Filters an array of function analysis objects, keeping only those worth testing.
 *
 * @param {object[]} functions - Array of function registry entries (from getFileAnalysis)
 * @param {object} options
 * @param {number} [options.minScore=3] - Minimum score to be considered testable
 * @param {boolean} [options.verbose=true] - Log filtering decisions
 * @returns {object[]} Filtered array of testable functions
 */
function filterTestable(functions, options = {}) {
    const minScore = options.minScore !== undefined ? options.minScore : 3;
    const verbose = options.verbose !== false;

    if (!functions || functions.length === 0) return [];

    const selected = [];
    const skipped = [];

    for (const func of functions) {
        const { score, reasons } = scoreFunction(func);

        if (score >= minScore) {
            selected.push(func);
            if (verbose) {
                console.log(
                    chalk.green(`  ✔ [TESTABLE]`) +
                    chalk.white(` ${func.name}`) +
                    chalk.dim(` (score: ${score} — ${reasons.join(", ")})`)
                );
            }
        } else {
            skipped.push(func);
            if (verbose) {
                console.log(
                    chalk.yellow(`  ✗ [SKIP]`) +
                    chalk.dim(` ${func.name}`) +
                    chalk.dim(` (score: ${score} — ${reasons.join(", ")})`)
                );
            }
        }
    }

    if (verbose) {
        console.log("");
        console.log(
            chalk.cyan(`  Smart selector: `) +
            chalk.bold.green(`${selected.length} testable`) +
            chalk.dim(` / ${skipped.length} skipped out of ${functions.length} total functions`)
        );
        console.log("");
    }

    return selected;
}

module.exports = {
    filterTestable,
    scoreFunction
};
