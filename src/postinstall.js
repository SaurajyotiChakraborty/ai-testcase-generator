#!/usr/bin/env node

/**
 * postinstall.js
 * Runs automatically after `npm install -D codecase-ai`.
 *
 * KEY FIX: npm runs postinstall scripts as child processes that don't inherit
 * stdin as a TTY. We open the terminal device directly (\\.\CON on Windows,
 * /dev/tty on Unix) so inquirer gets a real interactive stream.
 */

const fs = require("fs");
const path = require("path");

// Use INIT_CWD (set by npm to the directory where `npm install` was run)
const projectRoot = process.env.INIT_CWD || process.cwd();

// ── Guard: Skip in CI environments ─────────────────────────────────────────
if (
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.BUILD_NUMBER ||
    process.env.GITHUB_ACTIONS ||
    process.env.TRAVIS ||
    process.env.CIRCLECI
) {
    console.log("\n[codecase-ai] CI environment detected — skipping interactive setup.");
    console.log("[codecase-ai] Run `npx codecase-ai init` to configure.\n");
    process.exit(0);
}

// ── Guard: Skip if config already exists ──────────────────────────────────
const configPath = path.join(projectRoot, "aitest.config.json");
if (fs.existsSync(configPath)) {
    console.log("\n[codecase-ai] aitest.config.json already exists — skipping setup.");
    console.log("[codecase-ai] Run `npx codecase-ai init` to reconfigure.\n");
    process.exit(0);
}

// ── Open the terminal device directly ─────────────────────────────────────
// npm spawns postinstall without a real TTY stdin, so we open the
// terminal device ourselves. This is the standard pattern for npm
// postinstall wizards (used by create-react-app, etc.)
let ttyFd;
try {
    // Windows: \\.\CON  |  Unix/Mac: /dev/tty
    const ttyPath = process.platform === "win32" ? "\\\\.\\CON" : "/dev/tty";
    ttyFd = fs.openSync(ttyPath, "r+");
    const ttyStream = new (require("tty").ReadStream)(ttyFd);

    // Patch process.stdin so inquirer uses our real TTY stream
    process.stdin = ttyStream;
} catch (e) {
    // Could not open terminal — truly non-interactive, skip gracefully
    console.log("\n[codecase-ai] Could not open terminal for interactive setup.");
    console.log("[codecase-ai] Run `npx codecase-ai init` to configure.\n");
    process.exit(0);
}

// ── All checks passed — run the wizard ────────────────────────────────────
const { runSetupWizard } = require("./setupWizard");

runSetupWizard(projectRoot)
    .then(() => {
        if (ttyFd !== undefined) {
            try { fs.closeSync(ttyFd); } catch (_) {}
        }
        process.exit(0);
    })
    .catch((err) => {
        console.error("\n[codecase-ai] Setup wizard error:", err.message);
        console.error("[codecase-ai] Run `npx codecase-ai init` to configure manually.\n");
        if (ttyFd !== undefined) {
            try { fs.closeSync(ttyFd); } catch (_) {}
        }
        process.exit(0); // Never fail the install
    });
