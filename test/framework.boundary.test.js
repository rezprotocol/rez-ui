import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (entry.isFile() && full.endsWith(".js")) out.push(full);
  }
  return out;
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function extractSpecifiers(text) {
  const stripped = stripComments(text);
  const out = [];
  const importFromRe = /^\s*import\s+[^;]*?\s+from\s+["']([^"']+)["']/gm;
  const exportFromRe = /^\s*export\s+[^;]*?\s+from\s+["']([^"']+)["']/gm;
  const dynamicImportRe = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const re of [importFromRe, exportFromRe, dynamicImportRe]) {
    let match;
    while ((match = re.exec(stripped)) != null) out.push(match[1]);
  }
  return out;
}

test("rez-ui framework has no app/runtime folder", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "apps")), false);
  assert.equal(fs.existsSync(path.join(ROOT, "bootstrap")), false);
  assert.equal(fs.existsSync(path.join(ROOT, "platform")), false);
});

test("rez-ui framework does not import app/runtime layers", () => {
  const files = walk(ROOT);
  const violations = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const specifiers = extractSpecifiers(text);
    for (const specifier of specifiers) {
      const normalized = String(specifier || "").trim();
      if (
        normalized.startsWith("@rezprotocol/sdk") ||
        normalized.startsWith("@rezprotocol/contracts") ||
        normalized.startsWith("@rezprotocol/node") ||
        normalized === "@rezprotocol/core" ||
        normalized.startsWith("@rezprotocol/core/") ||
        normalized === "rez-chat" ||
        normalized.startsWith("rez-chat/")
      ) {
        violations.push(`${path.relative(ROOT, file)} -> ${normalized}`);
      }
      if (
        normalized.includes("/rez-chat/") ||
        normalized.includes("../rez-chat/")
      ) {
        violations.push(`${path.relative(ROOT, file)} -> uses workspace path import ${normalized}`);
      }
    }
  }
  assert.deepEqual(violations, [], violations.join("\n"));
});

test("legacy rez-ui platform must not import rez-ui app chat modules", () => {
  const platformRoot = path.join(ROOT, "platform");
  if (!fs.existsSync(platformRoot)) {
    assert.equal(true, true);
    return;
  }

  const files = walk(platformRoot);
  const violations = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const specifiers = extractSpecifiers(text);
    for (const specifier of specifiers) {
      const normalized = String(specifier || "").replace(/\\/g, "/");
      if (
        normalized.includes("/apps/chat/") ||
        normalized.includes("../apps/chat/") ||
        normalized.startsWith("rez-ui/src/apps/chat")
      ) {
        violations.push(`${path.relative(ROOT, file)} -> ${normalized}`);
      }
    }
  }

  assert.deepEqual(violations, [], violations.join("\n"));
});

const FORBIDDEN_CHAT_NOUNS = ["Thread", "Message", "Invite", "Composer", "Group"];
test("rez-ui must not contain files with chat-domain nouns in filename", () => {
  const files = walk(ROOT);
  const violations = [];
  for (const file of files) {
    const base = path.basename(file, path.extname(file));
    for (const noun of FORBIDDEN_CHAT_NOUNS) {
      if (base.includes(noun)) {
        violations.push(path.relative(ROOT, file));
        break;
      }
    }
  }
  assert.deepEqual(violations, [], `Forbidden chat nouns in filenames: ${violations.join(", ")}`);
});

test("rez-ui must not contain chat stores or services directories", () => {
  const storesDir = path.join(ROOT, "stores");
  const servicesDir = path.join(ROOT, "services");
  assert.equal(fs.existsSync(storesDir), false, "rez-ui must not have src/stores (chat stores live in rez-chat)");
  assert.equal(fs.existsSync(servicesDir), false, "rez-ui must not have src/services (chat services live in rez-chat)");
});
