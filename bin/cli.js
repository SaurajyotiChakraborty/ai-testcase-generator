#!/usr/bin/env node

const path = require("path");

// Load .env from the USER's project directory (cwd), not the package install directory
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

// CLI Entrypoint
const { runCLI } = require("../src/config/loadConfig");

runCLI(process.argv);
