# codecase-ai

> AI-powered unit test generator for JavaScript and TypeScript projects.

Analyzes your source files, understands your exports, hooks, and components,  
and writes complete test cases automatically — no configuration required.

---

## Table of Contents

- [Install](#install)
- [Setup](#setup)
- [Add Your API Key](#add-your-api-key)
- [Generate Tests](#generate-tests)
- [All Commands](#all-commands)
- [All Options](#all-options)
- [Framework Selection](#framework-selection)
- [Supported Frameworks](#supported-frameworks)
- [Supported AI Providers](#supported-ai-providers)
- [Configuration File](#configuration-file)
- [How It Works](#how-it-works)
- [Security](#security)

---

## Install

You do not need to install anything to get started. Use `npx`:

```bash
npx codecase-ai init
```

Or install globally so you can use it without `npx`:

```bash
npm install -g codecase-ai
```

After global install, use `codecase-ai` directly:

```bash
codecase-ai init
codecase-ai run
```

---

## Setup

Run the setup wizard once in your project folder:

```bash
npx codecase-ai init
```

This will:

1. Ask you to choose an AI provider (Gemini, OpenAI, or Claude)
2. Ask for your API key (stored safely in `.env.local`, never shown in terminal)
3. Ask which test framework to use (Jest, Vitest, or Mocha)
4. Ask which folder to scan (default: `src/`)
5. Save your choices to `.aitestgenrc.json`

After setup, you can run test generation anytime with:

```bash
npx codecase-ai run
```

---

## Add Your API Key

Create a `.env.local` file in your project root and add your key:

```
# Google Gemini (free, recommended)
GEMINI_API_KEY=your_key_here

# OpenAI (GPT-4o)
OPENAI_API_KEY=your_key_here

# Anthropic Claude
ANTHROPIC_API_KEY=your_key_here
```

> Add `.env.local` to your `.gitignore` so the key is never committed.

Get a free Gemini key at: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

Your API key is **never printed to the terminal** at any point.

---

## Generate Tests

### Generate for your whole project

```bash
npx codecase-ai run
```

### Generate for a single file

```bash
npx codecase-ai run src/utils/format.ts
```

### Generate for a specific folder

```bash
npx codecase-ai run src/components/
```

### Skip all confirmation prompts

```bash
npx codecase-ai run --yes
```

### Choose a specific test framework

```bash
npx codecase-ai run --framework jest
npx codecase-ai run --framework vitest
npx codecase-ai run --framework mocha
```

### Use a specific AI provider

```bash
npx codecase-ai run --provider gemini
npx codecase-ai run --provider openai
npx codecase-ai run --provider claude
```

### Change output folder

```bash
npx codecase-ai run --output tests/
```

---

## All Commands

| Command | What it does |
|---|---|
| `npx codecase-ai init` | First-time setup wizard |
| `npx codecase-ai run` | Generate tests for your project |
| `npx codecase-ai run <path>` | Generate tests for a file or folder |
| `npx codecase-ai --version` | Print the installed version |
| `npx codecase-ai --help` | Print all available options |

---

## All Options

These options work with the `run` command:

| Option | Short | Description | Default |
|---|---|---|---|
| `--framework <name>` | `-f` | Test runner: `jest`, `vitest`, `mocha` | auto-detect |
| `--provider <name>` | `-p` | AI provider: `gemini`, `openai`, `claude` | `gemini` |
| `--output <dir>` | `-o` | Output directory for test files | `generated-tests` |
| `--concurrency <n>` | `-c` | Files to process at once | `1` |
| `--yes` | `-y` | Skip all confirmation prompts | off |
| `--path <path>` | | File or folder to scan | `.aitestgenrc.json` value |
| `--api-key <key>` | `-k` | API key (prefer `.env.local` instead) | — |

**Examples:**

```bash
# Run with all options
npx codecase-ai run src/ --framework jest --provider gemini --output tests/ --yes

# Run a single file, skip prompts
npx codecase-ai run src/api/users.ts --yes

# Run with OpenAI on a specific folder
npx codecase-ai run src/hooks/ --provider openai --framework jest
```

---

## Framework Selection

When you run `npx codecase-ai run`, the tool auto-detects your test framework  
from your `package.json`, config files, and dependencies.

If it detects a framework, it shows what it found:

```
  Provider : gemini  |  Runner: jest  |  Output: generated-tests
```

If it cannot detect the framework clearly, it shows a selection menu:

```
? Select test framework (auto-detected: jest):
❯ Jest       — use Jest (auto-detected)
  Vitest     — use Vitest
  Mocha      — use Mocha + Chai
```

To skip the menu, pass `--framework` directly:

```bash
npx codecase-ai run --framework vitest
```

Or save it permanently in `.aitestgenrc.json`:

```json
{
  "testRunner": "vitest"
}
```

---

## Supported Frameworks

| Project type | Detected | Test files generated |
|---|---|---|
| Next.js | ✅ | `.test.tsx` (Jest) |
| React + CRA | ✅ | `.test.tsx` (Jest) |
| React + Vite | ✅ | `.test.tsx` (Vitest) |
| Vue | ✅ | `.test.ts` |
| Nuxt | ✅ | `.test.ts` |
| Angular | ✅ | `.spec.ts` |
| Svelte / SvelteKit | ✅ | `.test.ts` |
| Remix | ✅ | `.test.tsx` |
| Astro | ✅ | `.test.ts` |
| Express | ✅ | `.test.js` |
| NestJS | ✅ | `.test.ts` |
| Plain Node.js | ✅ | `.test.js` or `.test.ts` |

---

## Supported AI Providers

| Provider | Default model | Key variable | Free tier |
|---|---|---|---|
| **Gemini** *(recommended)* | `gemini-2.5-flash` | `GEMINI_API_KEY` | ✅ Yes |
| **OpenAI** | `gpt-4o` | `OPENAI_API_KEY` | ❌ Paid |
| **Claude** | `claude-3-5-sonnet` | `ANTHROPIC_API_KEY` | ❌ Paid |

**Extra install for OpenAI or Claude:**

```bash
npm install openai              # for OpenAI
npm install @anthropic-ai/sdk   # for Claude
```

---

## Configuration File

Running `init` creates `.aitestgenrc.json` in your project root:

```json
{
  "provider": "gemini",
  "testRunner": "jest",
  "targetPath": "src/",
  "outputDir": "generated-tests",
  "concurrency": 1,
  "ignore": []
}
```

You can edit this file manually at any time.

**`ignore` examples:**

```json
{
  "ignore": ["src/generated/", "src/mocks/", "src/types/"]
}
```

CLI flags always override the config file values.

---

## How It Works

```
Your source file
      │
      ▼
  AST Parser         — reads code structure (not regex)
      │
      ▼
 Export Extractor    — finds exported functions, components, hooks
      │
      ▼
 Context Builder     — includes direct imports as context
      │
      ▼
  AI Generator       — sends grounded prompt to Gemini / OpenAI / Claude
      │
      ▼
  Validator          — checks syntax, imports, secrets, dangerous code
      │
      ▼
 Approval Prompt     — asks before writing (unless --yes)
      │
      ▼
  Test File          — saved to generated-tests/
```

**What is analyzed:**

- Exported functions and their signatures
- React components, hooks, context providers
- Next.js routes (including dynamic `[id]`, route groups `(group)`)
- Direct import dependencies (1 level deep)
- Your `package.json` dependency list
- Your Jest / Vitest / tsconfig configuration

---

## Security

### API key

- Never printed to the terminal
- Never stored in generated test files
- Read only from `.env.local`, `.env`, or the `--api-key` flag (masked)
- Sent only to the AI provider over HTTPS

### Generated test safety

Before saving any test file, the generator checks for:

| Check | What it looks for |
|---|---|
| **Syntax validation** | TypeScript AST parse — rejects malformed code |
| **Hallucination check** | Rejects tests that import names your file doesn't export |
| **Secret detection** | Rejects hardcoded API keys, tokens, passwords |
| **Dangerous patterns** | Rejects `eval()`, `exec()`, `child_process`, `fs.writeFileSync()` |
| **Style assertions** | Warns if tests check Tailwind CSS classes instead of behavior |
| **Generic names** | Warns if test names are `test1`, `works`, `button test` |

Files that fail security checks are **never written to disk**.

---

## License

ISC — free for personal and commercial use.
