#!/usr/bin/env node
"use strict";

// Preserve the lesson-only default while sharing latest-only output and bounded execution
// with the installed commands. Insert before -- so dash-prefixed inputs work.
const args = process.argv.slice(2);
const separator = args.indexOf("--");
args.splice(separator < 0 ? args.length : separator, 0, "--profile", "lesson");
require("./src/cli/index.cjs").run(args);
