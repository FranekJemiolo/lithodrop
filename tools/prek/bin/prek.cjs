#!/usr/bin/env node
const { spawn } = require("child_process");

const args = process.argv.slice(2);
const child = spawn("prek", args, { stdio: "inherit" });

child.on("error", (err) => {
  console.error("Failed to run prek:", err.message);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code !== null ? code : 0);
});
