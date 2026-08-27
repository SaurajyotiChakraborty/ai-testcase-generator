const fs = require("fs");
const path = require("path");

/**
 * Returns the required test dependencies for a given framework/testRunner combo.
 * Only includes deps that are actually needed based on what the project uses.
 * Never installs unnecessary deps.
 */
function getRequiredDependencies(frameworkInfo, testRunner, isTypescript) {
    const deps = [];

    if (testRunner === "jest") {
        deps.push("jest");

        // React / JSX requires jest-dom + RTL
        if (frameworkInfo.isReact || frameworkInfo.isNextJs) {
            deps.push("jest-environment-jsdom");
            deps.push("@testing-library/react");
            deps.push("@testing-library/jest-dom");
            deps.push("@testing-library/user-event");
        }

        // TypeScript support
        if (isTypescript) {
            deps.push("ts-jest");
            deps.push("@types/jest");
        }

        // Next.js specific
        if (frameworkInfo.isNextJs) {
            deps.push("identity-obj-proxy");
        }

    } else if (testRunner === "vitest") {
        deps.push("vitest");

        // React / JSX with Vitest
        if (frameworkInfo.isReact || frameworkInfo.isNextJs) {
            deps.push("jsdom");
            deps.push("@testing-library/react");
            deps.push("@testing-library/jest-dom");
            deps.push("@testing-library/user-event");

            // React plugin for Vitest
            if (!frameworkInfo.isNextJs) {
                deps.push("@vitejs/plugin-react");
            }
        }

    } else if (testRunner === "mocha") {
        deps.push("mocha");

        // React / JSX with Mocha
        if (frameworkInfo.isReact) {
            deps.push("@testing-library/react");
            deps.push("@testing-library/jest-dom");
            deps.push("@testing-library/user-event");
            deps.push("jsdom");
            deps.push("@jsdom/global"); // polyfill globals for Mocha
        }

        // Chai is the standard assertion library for Mocha
        deps.push("chai");

        // TypeScript support for Mocha
        if (isTypescript) {
            deps.push("ts-node");
            deps.push("@types/mocha");
            deps.push("@types/chai");
        }
    }

    return deps;
}

function checkMissingDependencies(projectRoot, requiredDeps) {
    const pkgPath = path.join(projectRoot, "package.json");
    let installed = {};
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            installed = { ...pkg.dependencies, ...pkg.devDependencies };
        } catch (e) {}
    }

    const missing = [];
    for (const dep of requiredDeps) {
        if (!installed[dep]) {
            const nodeModulePath = path.join(projectRoot, "node_modules", dep);
            if (!fs.existsSync(nodeModulePath)) {
                missing.push(dep);
            }
        }
    }

    return missing;
}

module.exports = {
    getRequiredDependencies,
    checkMissingDependencies
};
