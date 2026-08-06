# ai-testcase-generator

**Automatically generate comprehensive, framework-aware unit tests using AI.**

`ai-testcase-generator` analyzes your JavaScript/TypeScript project using deep AST parsing to extract control flow, data flow, and complexity metrics. It then uses this deep semantic understanding to generate robust test suites via Google Gemini AI.

## Features

- 🧠 **Deep Semantic Parsing**: Uses `ts-morph` to extract functions, classes, conditionals, loops, returns, throws, and execution paths.
- 🚦 **Control Flow Graph (CFG)**: Analyzes branches and loops to ensure generated tests hit all execution paths.
- 📦 **Data Flow Analysis**: Tracks variable reassignments and parameter usage to generate precise edge-case tests.
- ⚙️ **Framework Auto-Detection**: Automatically detects if you're using **Jest**, **Vitest**, **Mocha**, or **Jasmine** and formats tests accordingly.
- 🏗️ **Dependency Graph**: Automatically adds correct `require()` / `import` statements into the generated test files.
- 📊 **Complexity Driven**: Computes cyclomatic complexity and nesting depth to prioritize thoroughness.

## Installation

You can install it globally to use across any project:

```bash
npm install -g ai-testcase-generator
```

Or install it locally as a dev dependency:

```bash
npm install -D ai-testcase-generator
```

## Setup

You need a Google Gemini API key to use the tool. There are three ways to provide it:

1. **Environment Variable**: Set `GEMINI_API_KEY` in your shell or a `.env` file.
2. **CLI Flag**: Pass it directly via `--api-key your_key_here`.
3. **Config File**: Add it to `aitest.config.js`.

## Quick Start

Run the CLI in your project root. It will automatically detect your framework and scan the `./src` folder by default.

```bash
npx ai-testcase-generator
```

Tests will be generated in the `./generated-tests` folder.

## CLI Options

```bash
ai-testcase-generator [path] [options]

Arguments:
  path                    Target directory or file to analyze (default: "./src")

Options:
  -V, --version           Output the version number
  -f, --framework <name>  Testing framework (jest, vitest, mocha, jasmine, auto) (default: "auto")
  -o, --output <dir>      Output directory (default: "generated-tests")
  -m, --model <name>      AI model to use (default: "gemini-3.6-flash")
  -k, --api-key <key>     Gemini API Key (overrides env/config)
  -a, --analyze-only      Run analysis only, do not generate tests
  -i, --ignore <paths...> Additional folders/files to ignore
  -c, --concurrency <n>   Number of concurrent files to process (default: 3)
  --no-cache              Disable incremental caching and force regeneration
  -v, --verbose           Enable verbose logging
  -h, --help              Display help
```

## Configuration File

Instead of passing CLI flags every time, you can create an `aitest.config.js` (or `.json`) file in the root of your project:

```javascript
// aitest.config.js
module.exports = {
    target: "./src",
    output: "./tests/__ai__",
    framework: "jest",
    model: "gemini-3.6-flash",
    ignore: ["migrations", "scripts"],
    concurrency: 3
};
```

CLI flags will override settings in the config file.

## How It Works

1. **Phase 1 (Static Analysis)**: The tool recursively scans your target directory, parsing all JS/TS files. It extracts a complete internal metadata registry of every normal function, arrow function, and class method. It builds a Control Flow Graph, tracks data flow, and maps out a file-dependency graph.
2. **Phase 2 (AI Generation)**: The deep semantic analysis is compiled into a highly structured prompt (per-function) and sent to Gemini. The LLM generates Positive, Negative, Edge, and Exception test cases.
3. **Phase 3 (Writing)**: The raw generated code is saved into `.test.js` files, complete with appropriate framework imports and `describe/it` blocks.
