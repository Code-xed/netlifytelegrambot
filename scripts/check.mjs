import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, extname } from "node:path";

const root = process.cwd();
const skipped = new Set(["node_modules", ".git", ".netlify"]);
const files = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && skipped.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if ([".js", ".mjs"].includes(extname(entry.name))) files.push(path);
  }
}

await walk(root);
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(`\nSyntax error in ${file}\n${result.stderr || result.stdout}`);
  }
}
if (failed) process.exit(1);
console.log(`Syntax check passed for ${files.length} JavaScript files.`);
