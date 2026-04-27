import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const testRoot = ".test-build/tests";
const testFiles = [];

function collectTestFiles(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      collectTestFiles(path);
    } else if (path.endsWith(".test.js")) {
      testFiles.push(path);
    }
  }
}

collectTestFiles(testRoot);

if (testFiles.length === 0) {
  console.error(`No compiled test files found in ${testRoot}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
