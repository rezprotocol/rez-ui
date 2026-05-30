import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/snap/bin/chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function existsExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveChromePath() {
  for (const candidate of CHROME_CANDIDATES) {
    if (existsExecutable(candidate)) return candidate;
  }
  return null;
}

export function runPreflight() {
  try {
    require.resolve("playwright-core");
  } catch {
    throw new Error(
      "Playwright dependency missing: playwright-core is not installed. Install from vendored tarballs before running e2e.",
    );
  }

  const chromePath = process.env.CHROME_PATH || resolveChromePath();
  if (!chromePath) {
    throw new Error(
      "Chrome not found. Install Google Chrome (or set CHROME_PATH) to run offline e2e with playwright-core.",
    );
  }

  process.env.CHROME_PATH = chromePath;
  console.log(`[e2e preflight] chrome=${chromePath}`);
  return chromePath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    runPreflight();
  } catch (err) {
    console.error(String(err?.message || err));
    process.exit(1);
  }
}
