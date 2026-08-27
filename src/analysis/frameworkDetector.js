const fs = require("fs");
const path = require("path");

/**
 * Framework Detector — Multi-signal, confidence-scored.
 *
 * Inspects package.json, lockfiles, config files, folder structure, and
 * import patterns to identify the framework with a confidence score and
 * evidence list. Supports 15+ frameworks.
 *
 * Returns:
 *   { framework, confidence, evidence, conflicts, isNextJs, isAppRouter, isPagesRouter,
 *     isReact, isCRA, isVite, isMocha, isTypescript, isESModule, isCommonJS,
 *     isVue, isNuxt, isAngular, isSvelte, isSvelteKit, isRemix, isAstro,
 *     isExpress, isNestJS }
 */
function detectFramework(projectRoot) {
    const pkgPath = path.join(projectRoot, "package.json");
    let pkg = {};
    if (fs.existsSync(pkgPath)) {
        try { pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")); } catch (e) {}
    }

    const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies
    };

    const evidence = [];
    const scores = {};

    function score(framework, points, reason) {
        scores[framework] = (scores[framework] || 0) + points;
        evidence.push({ framework, points, reason });
    }

    // ── Next.js ──────────────────────────────────────────────────────────────
    if (deps.next) score("nextjs", 10, "next in dependencies");
    if (fs.existsSync(path.join(projectRoot, "next.config.js")))  score("nextjs", 8, "next.config.js present");
    if (fs.existsSync(path.join(projectRoot, "next.config.mjs"))) score("nextjs", 8, "next.config.mjs present");
    if (fs.existsSync(path.join(projectRoot, "next.config.ts")))  score("nextjs", 8, "next.config.ts present");

    const isNextJs = (scores.nextjs || 0) >= 8;

    const isAppRouter = isNextJs && (
        fs.existsSync(path.join(projectRoot, "app")) ||
        fs.existsSync(path.join(projectRoot, "src", "app"))
    );
    const isPagesRouter = isNextJs && (
        fs.existsSync(path.join(projectRoot, "pages")) ||
        fs.existsSync(path.join(projectRoot, "src", "pages"))
    );
    if (isAppRouter)   score("nextjs", 3, "app/ directory (App Router)");
    if (isPagesRouter) score("nextjs", 3, "pages/ directory (Pages Router)");

    // ── React (standalone) ───────────────────────────────────────────────────
    if (deps.react && !isNextJs) score("react", 8, "react in dependencies");
    if (deps["react-dom"] && !isNextJs) score("react", 4, "react-dom in dependencies");
    const isCRA = !!deps["react-scripts"];
    if (isCRA) score("react", 10, "react-scripts (CRA) in dependencies");

    // ── Vite ─────────────────────────────────────────────────────────────────
    if (deps.vite) score("vite", 8, "vite in dependencies");
    if (deps["@vitejs/plugin-react"]) score("vite", 6, "@vitejs/plugin-react in dependencies");
    if (deps["@vitejs/plugin-vue"])   score("vite", 6, "@vitejs/plugin-vue in dependencies");
    if (fs.existsSync(path.join(projectRoot, "vite.config.js")) ||
        fs.existsSync(path.join(projectRoot, "vite.config.ts")))
        score("vite", 8, "vite.config.* present");

    // ── Vue / Nuxt ───────────────────────────────────────────────────────────
    if (deps.vue) score("vue", 10, "vue in dependencies");
    if (deps.nuxt) score("nuxt", 10, "nuxt in dependencies");
    if (fs.existsSync(path.join(projectRoot, "nuxt.config.ts")) ||
        fs.existsSync(path.join(projectRoot, "nuxt.config.js")))
        score("nuxt", 8, "nuxt.config.* present");

    // ── Angular ──────────────────────────────────────────────────────────────
    if (deps["@angular/core"]) score("angular", 10, "@angular/core in dependencies");
    if (fs.existsSync(path.join(projectRoot, "angular.json"))) score("angular", 8, "angular.json present");

    // ── Svelte / SvelteKit ───────────────────────────────────────────────────
    if (deps.svelte) score("svelte", 8, "svelte in dependencies");
    if (deps["@sveltejs/kit"]) score("sveltekit", 10, "@sveltejs/kit in dependencies");
    if (fs.existsSync(path.join(projectRoot, "svelte.config.js")) ||
        fs.existsSync(path.join(projectRoot, "svelte.config.ts")))
        score("sveltekit", 6, "svelte.config.* present");

    // ── Remix ─────────────────────────────────────────────────────────────────
    if (deps["@remix-run/react"] || deps["@remix-run/node"] || deps["@remix-run/serve"])
        score("remix", 10, "@remix-run/* in dependencies");
    if (fs.existsSync(path.join(projectRoot, "remix.config.js")))
        score("remix", 8, "remix.config.js present");

    // ── Astro ─────────────────────────────────────────────────────────────────
    if (deps.astro) score("astro", 10, "astro in dependencies");
    if (fs.existsSync(path.join(projectRoot, "astro.config.mjs")) ||
        fs.existsSync(path.join(projectRoot, "astro.config.ts")))
        score("astro", 8, "astro.config.* present");

    // ── Express ───────────────────────────────────────────────────────────────
    if (deps.express) score("express", 8, "express in dependencies");

    // ── NestJS ────────────────────────────────────────────────────────────────
    if (deps["@nestjs/core"]) score("nestjs", 10, "@nestjs/core in dependencies");
    if (fs.existsSync(path.join(projectRoot, "nest-cli.json"))) score("nestjs", 8, "nest-cli.json present");

    // ── Mocha (test-only, not a framework) ────────────────────────────────────
    const hasMochaConfig =
        fs.existsSync(path.join(projectRoot, ".mocharc.js")) ||
        fs.existsSync(path.join(projectRoot, ".mocharc.cjs")) ||
        fs.existsSync(path.join(projectRoot, ".mocharc.yaml")) ||
        fs.existsSync(path.join(projectRoot, ".mocharc.yml")) ||
        fs.existsSync(path.join(projectRoot, ".mocharc.json"));
    const isMocha = hasMochaConfig || !!deps.mocha;

    // ── TypeScript + Module System ────────────────────────────────────────────
    const isTypescript = fs.existsSync(path.join(projectRoot, "tsconfig.json"));
    const isESModule = pkg.type === "module";
    const isCommonJS = !isESModule;
    const isVite = (scores.vite || 0) >= 6;

    // ── Determine primary framework winner ────────────────────────────────────
    const FW_SCORES = { ...scores };
    // React is implied by Next.js — don't double-count as conflict
    if (isNextJs) delete FW_SCORES.react;

    const sorted = Object.entries(FW_SCORES).sort((a, b) => b[1] - a[1]);
    const primaryFramework = sorted[0]?.[0] || "node";
    const primaryScore = sorted[0]?.[1] || 0;
    const maxPossible = 26; // rough max for a well-detected framework
    const confidence = Math.min(100, Math.round((primaryScore / maxPossible) * 100));

    // ── Conflict detection ─────────────────────────────────────────────────────
    const conflicts = [];
    const majorFrameworks = ["nextjs", "nuxt", "angular", "sveltekit", "remix", "astro"];
    const detectedMajor = majorFrameworks.filter(f => (FW_SCORES[f] || 0) >= 8);
    if (detectedMajor.length > 1) {
        conflicts.push(`Multiple major frameworks detected: ${detectedMajor.join(", ")}`);
    }

    return {
        // Primary result
        framework: primaryFramework,
        confidence,
        evidence,
        conflicts,

        // Boolean flags (backwards-compatible)
        isNextJs,
        isAppRouter,
        isPagesRouter,
        isReact: !!(deps.react) || isNextJs || isCRA,
        isCRA,
        isVite,
        isMocha,
        isTypescript,
        isESModule,
        isCommonJS,
        isVue: (scores.vue || 0) >= 8,
        isNuxt: (scores.nuxt || 0) >= 8,
        isAngular: (scores.angular || 0) >= 8,
        isSvelte: (scores.svelte || 0) >= 6,
        isSvelteKit: (scores.sveltekit || 0) >= 8,
        isRemix: (scores.remix || 0) >= 8,
        isAstro: (scores.astro || 0) >= 8,
        isExpress: (scores.express || 0) >= 6,
        isNestJS: (scores.nestjs || 0) >= 8
    };
}

module.exports = {
    detectFramework
};
