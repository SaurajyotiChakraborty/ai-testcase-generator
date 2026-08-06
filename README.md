# ai-testcase-generator

**Automatically generate comprehensive, framework-aware unit tests using AI.**

`ai-testcase-generator` analyzes your JavaScript/TypeScript project using deep AST parsing to extract control flow, data flow, and complexity metrics. It then uses this deep semantic understanding to generate robust test suites via your choice of AI provider.

## Features

- 🧠 **Deep Semantic Parsing**: Uses `ts-morph` to extract functions, classes, conditionals, loops, returns, throws, and execution paths.
- 🚦 **Control Flow Graph (CFG)**: Analyzes branches and loops to ensure generated tests hit all execution paths.
- 📦 **Data Flow Analysis**: Tracks variable reassignments and parameter usage to generate precise edge-case tests.
- ⚙️ **Framework Auto-Detection**: Automatically detects if you're using **Jest**, **Vitest**, **Mocha**, or **Jasmine** and formats tests accordingly.
- 🤖 **Multi-Provider AI**: Supports **Google Gemini**, **OpenAI (ChatGPT)**, and **Anthropic (Claude)**.
- 🏗️ **Dependency Graph**: Automatically adds correct `require()` / `import` statements into the generated test files.
- 📊 **Complexity Driven**: Computes cyclomatic complexity and nesting depth to prioritize thoroughness.
- ⚡ **Parallel Processing**: Processes multiple files concurrently for faster generation.
- 💾 **Incremental Caching**: Skips unchanged files to save time and API tokens.

## Installation

```bash
npm install -D ai-testcase-generator
```

## Supported AI Providers

| Provider | Install Command | Default Model |
|----------|----------------|---------------|
| **Google Gemini** (default) | Included automatically | `gemini-3.6-flash` |
| **OpenAI / ChatGPT** | `npm install openai` | `gpt-5.6-luna` |
| **Anthropic / Claude** | `npm install @anthropic-ai/sdk` | `claude-sonnet-5` |

You only need to install the SDK for the provider you want to use. Gemini works out of the box.

## Setup

Provide your API key in one of three ways:

1. **Environment Variable**: `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`
2. **CLI Flag**: `--api-key your_key_here`
3. **Config File**: Add `apiKey` to `aitest.config.js`

## Quick Start

```bash
# Using Gemini (default)
npx ai-testcase-generator --api-key YOUR_GEMINI_KEY

# Using OpenAI
npx ai-testcase-generator --provider openai --api-key YOUR_OPENAI_KEY

# Using Claude
npx ai-testcase-generator --provider anthropic --api-key YOUR_ANTHROPIC_KEY
```

Tests will be generated in the `./generated-tests` folder.

## CLI Options

```bash
ai-testcase-generator [path] [options]

Arguments:
  path                        Target directory or file to analyze (default: "./src")

Options:
  -V, --version               Output the version number
  -p, --provider <name>       AI provider: gemini, openai, anthropic (default: "gemini")
  -f, --framework <name>      Testing framework: jest, vitest, mocha, jasmine, auto (default: "auto")
  -o, --output <dir>          Output directory (default: "generated-tests")
  -m, --model <name>          AI model to use (auto-selects best for provider)
  -k, --api-key <key>         API Key for the selected provider
  -a, --analyze-only          Run analysis only, do not generate tests
  -i, --ignore <paths...>     Additional folders/files to ignore
  -c, --concurrency <number>  Number of concurrent files to process (default: 3)
  --no-cache                  Disable incremental caching and force regeneration
  -v, --verbose               Enable verbose logging
  -h, --help                  Display help
```

## Configuration File

Instead of passing CLI flags every time, you can create an `aitest.config.js` (or `.json`) file in the root of your project:

```javascript
// aitest.config.js
module.exports = {
    provider: "openai",
    apiKey: "sk-...",
    model: "gpt-5.6-luna",
    target: "./src",
    output: "./tests/__ai__",
    framework: "jest",
    ignore: ["migrations", "scripts"],
    concurrency: 3
};
```

CLI flags will override settings in the config file.

## How It Works

1. **Phase 1 (Static Analysis)**: The tool recursively scans your target directory, parsing all JS/TS files. It extracts a complete internal metadata registry of every normal function, arrow function, and class method. It builds a Control Flow Graph, tracks data flow, and maps out a file-dependency graph.
2. **Phase 2 (AI Generation)**: The deep semantic analysis is compiled into a highly structured prompt (per-function) and sent to your chosen AI provider. The LLM generates Positive, Negative, Edge, and Exception test cases.
3. **Phase 3 (Writing)**: The raw generated code is saved into `.test.js` files, complete with appropriate framework imports and `describe/it` blocks.
