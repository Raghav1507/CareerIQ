/**
 * Runs a Python command with the workspace virtualenv when present.
 * Usage: node scripts/run.mjs -m pytest -q
 * Works on Windows (.venv/Scripts/python.exe) and POSIX (.venv/bin/python).
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  resolve(pkgRoot, ".venv", "Scripts", "python.exe"),
  resolve(pkgRoot, ".venv", "bin", "python"),
];
const python = candidates.find((p) => existsSync(p)) ?? "python";

const [, , ...args] = process.argv;
const result = spawnSync(python, args, { stdio: "inherit", cwd: pkgRoot });
process.exit(result.status ?? 1);
