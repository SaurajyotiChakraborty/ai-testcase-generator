const fs = require("fs");
const path = require("path");

/**
 * Detects test runner from project config files, package.json scripts, and dependencies.
 * Detection order: config files (most reliable) → deps → scripts → framework heuristics
 *
 * Also detects conflicting signals and returns them for user display.
 */
function detectPackageManager(projectRoot) {
    if (fs.existsSync(path.join(projectRoot, "bun.lockb"))) return "bun";
    if (fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
    if (fs.existsSync(path.join(projectRoot, "yarn.lock"))) return "yarn";
    return "npm";
}

function detectTestRunner(projectRoot, frameworkInfo = {}) {
    const pkgPath = path.join(projectRoot, "package.json");
    let pkg = {};
    if (fs.existsSync(pkgPath)) {
        try {
            pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        } catch (e) {}
    }

    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const testScript = pkg.scripts?.test || "";

    // ── Gather all signals ───────────────────────────────────────────────────
    const signals = [];
    const conflicts = [];

    // 1. Config files (most reliable)
    const hasVitestConfig = fs.readdirSync(projectRoot).some(f => f.startsWith("vitest.config."));
    const hasJestConfig = fs.readdirSync(projectRoot).some(f => f.startsWith("jest.config."));
    const hasMochaConfig =
        fs.existsSync(path.join(projectRoot, ".mocharc.js")) ||
        fs.existsSync(path.join(projectRoot, ".mocharc.cjs")) ||
        fs.existsSync(path.join(projectRoot, ".mocharc.yaml")) ||
        fs.existsSync(path.join(projectRoot, ".mocharc.yml")) ||
        fs.existsSync(path.join(projectRoot, ".mocharc.json"));
    const hasCypressConfig =
        fs.existsSync(path.join(projectRoot, "cypress.config.js")) ||
        fs.existsSync(path.join(projectRoot, "cypress.config.ts"));
    const hasPlaywrightConfig =
        fs.existsSync(path.join(projectRoot, "playwright.config.js")) ||
        fs.existsSync(path.join(projectRoot, "playwright.config.ts"));

    if (hasVitestConfig) signals.push({ runner: "vitest", source: "vitest.config.* file", weight: 10 });
    if (hasJestConfig)   signals.push({ runner: "jest",   source: "jest.config.* file",   weight: 10 });
    if (hasMochaConfig)  signals.push({ runner: "mocha",  source: ".mocharc.* file",       weight: 10 });
    if (hasCypressConfig)    signals.push({ runner: "cypress",    source: "cypress.config.* file",    weight: 8 });
    if (hasPlaywrightConfig) signals.push({ runner: "playwright", source: "playwright.config.* file", weight: 8 });

    // 2. Installed dependencies
    if (deps.vitest)      signals.push({ runner: "vitest",     source: "vitest in dependencies",      weight: 6 });
    if (deps.mocha)       signals.push({ runner: "mocha",      source: "mocha in dependencies",       weight: 6 });
    if (deps.jest)        signals.push({ runner: "jest",       source: "jest in dependencies",        weight: 6 });
    if (deps.cypress)     signals.push({ runner: "cypress",    source: "cypress in dependencies",     weight: 5 });
    if (deps.playwright || deps["@playwright/test"])
        signals.push({ runner: "playwright", source: "playwright in dependencies", weight: 5 });

    // 3. Test scripts
    if (testScript.includes("vitest")) signals.push({ runner: "vitest", source: 'test script contains "vitest"', weight: 4 });
    if (testScript.includes("mocha"))  signals.push({ runner: "mocha",  source: 'test script contains "mocha"',  weight: 4 });
    if (testScript.includes("jest"))   signals.push({ runner: "jest",   source: 'test script contains "jest"',   weight: 4 });

    // 4. Framework defaults
    if (frameworkInfo.isNextJs || frameworkInfo.isCRA) signals.push({ runner: "jest",   source: "Next.js/CRA default", weight: 2 });
    if (frameworkInfo.isVite)                          signals.push({ runner: "vitest", source: "Vite project default", weight: 2 });

    // ── Conflict detection ──────────────────────────────────────────────────
    const unitRunners = ["jest", "vitest", "mocha"];
    const detectedUnitRunners = [...new Set(
        signals.filter(s => unitRunners.includes(s.runner)).map(s => s.runner)
    )];

    if (detectedUnitRunners.length > 1) {
        conflicts.push(
            `Multiple unit test runners detected: ${detectedUnitRunners.join(", ")}. ` +
            `Evidence: ${signals.filter(s => unitRunners.includes(s.runner)).map(s => `${s.runner} (${s.source})`).join("; ")}`
        );
    }

    // ── Pick winner by highest total weight ─────────────────────────────────
    const scores = {};
    for (const s of signals) {
        scores[s.runner] = (scores[s.runner] || 0) + s.weight;
    }

    const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || "jest";

    return {
        runner: winner,
        signals,
        conflicts,
        scores
    };
}

module.exports = {
    detectPackageManager,
    detectTestRunner
};
