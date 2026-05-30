import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { runPreflight } from "./_harness/preflight.js";
import { startRezStack } from "./_harness/startRezStack.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function unlockViaUi(page, suffix) {
  const unlockButton = page.getByTestId("auth.unlock");
  const createButton = page.getByTestId("auth.create");
  await page.waitForFunction(function() {
    var unlock = document.querySelector("[data-testid='auth.unlock']");
    var create = document.querySelector("[data-testid='auth.create']");
    var visible = function(node) { return !!node && node instanceof HTMLElement && node.offsetParent !== null; };
    return visible(unlock) || visible(create);
  }, null, { timeout: 15000 });

  if (await unlockButton.isVisible().catch(() => false) && await unlockButton.isEnabled()) {
    await page.locator("[data-role='unlock-password']").fill(`test-pass-${suffix}`);
    await unlockButton.click();
  } else {
    await createButton.waitFor({ state: "visible", timeout: 15000 });
    await page.locator("[data-testid='auth.name']").fill(`E2E ${suffix}`);
    await page.locator("[data-role='signup-password']").fill(`test-pass-${suffix}`);
    await page.locator("[data-testid='auth.confirm']").fill(`test-pass-${suffix}`);
    await createButton.click();
  }

  try {
    await page.waitForFunction(function() {
      var status = document.querySelector("[data-testid='chat.connected']");
      var text = status ? String(status.textContent || "") : "";
      return text.indexOf("session=ready") !== -1 && text.indexOf("connection=connected") !== -1;
    }, null, { timeout: 30000 });
  } catch (err) {
    const statusText = await page.evaluate(function() {
      var el = document.querySelector("[data-testid='chat.connected']");
      return el ? String(el.textContent || "") : "(element not found)";
    }).catch(function() { return "(eval failed)"; });
    const alertText = await page.evaluate(function() {
      var el = document.querySelector("[data-testid='chat.alert.banner']");
      return el ? String(el.textContent || "") : "";
    }).catch(function() { return ""; });
    const dump = await dumpPageDebug(page, `unlockViaUi-${suffix}`);
    throw new Error(
      `unlockViaUi timeout; status="${statusText}"; alert="${alertText}"; screenshot=${dump.screenshotPath}; cause=${err && err.message ? err.message : err}`,
    );
  }
}

async function getAccountId(page) {
  const statusText = String(await page.getByTestId("chat.connected").textContent() || "");
  const match = statusText.match(/session=ready\s*\(([^)]+)\)/i);
  return match && match[1] ? String(match[1]).trim() : "";
}

async function dumpPageDebug(page, label) {
  const dir = path.resolve("rez-ui/test-results");
  await fs.mkdir(dir, { recursive: true });
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const safeLabel = String(label || "debug").replace(/[^a-zA-Z0-9._-]/g, "_");
  const screenshotPath = path.join(dir, `${safeLabel}-${stamp}.png`);
  const htmlPath = path.join(dir, `${safeLabel}-${stamp}.html`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  const html = await page.content().catch(() => "");
  await fs.writeFile(htmlPath, html, "utf8").catch(() => {});
  return { screenshotPath, htmlPath };
}

async function launchSingleStack(t, { debug = true } = {}) {
  const stack = await startRezStack({ debug });
  t.after(async () => {
    await stack.stop();
  });

  const playwright = await import("playwright-core");
  const browser = await playwright.chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
  });
  t.after(async () => {
    await browser.close().catch(() => {});
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", (err) => {
    // eslint-disable-next-line no-console
    console.error("[page:pageerror] " + (err && err.message ? err.message : String(err)));
  });
  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400) {
      // eslint-disable-next-line no-console
      console.error("[page:http-" + status + "] " + url);
    }
  });
  page.on("requestfailed", (request) => {
    var failure = request.failure();
    // eslint-disable-next-line no-console
    console.error("[page:request-failed] " + request.url() + " " + (failure ? failure.errorText : "unknown"));
  });
  page.on("websocket", (ws) => {
    ws.on("close", () => {
      // eslint-disable-next-line no-console
      console.error("[page:ws-close] " + ws.url());
    });
    ws.on("socketerror", (error) => {
      // eslint-disable-next-line no-console
      console.error("[page:ws-error] " + error);
    });
  });
  page.on("console", (msg) => {
    var type = msg.type();
    if (type === "error" || type === "warn") {
      // eslint-disable-next-line no-console
      console.error("[page:" + type + "] " + msg.text());
    }
  });

  return { stack, browser, context, page };
}

// ---------------------------------------------------------------------------
// Tests — single-stack (no relay mesh required)
// ---------------------------------------------------------------------------

test("e2e: auth create → session ready + connection connected", async (t) => {
  runPreflight();
  const { stack, context, page } = await launchSingleStack(t);

  await page.goto(stack.shellUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await unlockViaUi(page, "create");

  const accountId = await getAccountId(page);
  assert.ok(accountId.length > 0, "accountId should be non-empty after create");

  const statusText = String(await page.getByTestId("chat.connected").textContent() || "");
  assert.ok(statusText.includes("session=ready"), "session should be ready");
  assert.ok(statusText.includes("connection=connected"), "connection should be connected");

  await context.close();
});

test("e2e: auth unlock preserves identity after restart", async (t) => {
  runPreflight();
  const { stack, browser, page } = await launchSingleStack(t);

  await page.goto(stack.shellUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await unlockViaUi(page, "restart");

  const accountIdBefore = await getAccountId(page);
  assert.ok(accountIdBefore.length > 0, "accountId should be non-empty before restart");

  await stack.restart();

  await page.goto(stack.shellUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await unlockViaUi(page, "restart");

  const accountIdAfter = await getAccountId(page);
  assert.equal(accountIdAfter, accountIdBefore, "accountId should be preserved across restart");

  const statusText = String(await page.getByTestId("chat.connected").textContent() || "");
  assert.ok(statusText.includes("session=ready"), "session should be ready after restart unlock");
  assert.ok(statusText.includes("connection=connected"), "connection should be connected after restart unlock");

  await browser.close().catch(() => {});
});

test("e2e: invite create shows invite code", async (t) => {
  runPreflight();
  const { stack, context, page } = await launchSingleStack(t);

  await page.goto(stack.shellUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await unlockViaUi(page, "invite");

  await page.getByTestId("nav.contacts").click();
  await page.waitForSelector("[data-testid='contacts.view']", { timeout: 15000 });
  await page.getByTestId("contacts.subtab.invites").click();
  await page.getByTestId("invite.create.dm").click();

  try {
    await page.waitForFunction(function() {
      var el = document.querySelector("[data-testid='invite.code']");
      var code = el ? String(el.textContent || "").trim() : "";
      return code.length > 0 && code.indexOf("(no invite yet)") === -1;
    }, null, { timeout: 15000 });
  } catch (err) {
    const dump = await dumpPageDebug(page, "invite-create");
    throw new Error("invite code timeout; screenshot=" + dump.screenshotPath + " html=" + dump.htmlPath + "; cause=" + (err && err.message ? err.message : err));
  }

  const inviteCode = String(await page.getByTestId("invite.code").textContent() || "").trim();
  assert.ok(inviteCode.length > 0, "invite code should be non-empty");
  assert.ok(!inviteCode.includes("(no invite yet)"), "invite code should not be placeholder");

  await context.close();
});

test("e2e: system status renders node and mesh info", async (t) => {
  runPreflight();
  const { stack, context, page } = await launchSingleStack(t);

  await page.goto(stack.shellUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await unlockViaUi(page, "status");

  await page.getByTestId("nav.settings").click();

  try {
    await page.waitForSelector("[data-testid='system.connected-node']", { timeout: 15000 });
  } catch (err) {
    const dump = await dumpPageDebug(page, "system-status");
    throw new Error("system status timeout; screenshot=" + dump.screenshotPath + " html=" + dump.htmlPath + "; cause=" + (err && err.message ? err.message : err));
  }

  const nodeText = String(await page.getByTestId("system.connected-node").textContent() || "").trim();
  assert.ok(nodeText.length > 0, "connected node info should be non-empty");

  const meshExists = await page.locator("[data-testid='system.mesh']").count();
  assert.ok(meshExists > 0, "mesh status section should exist");

  await context.close();
});

// ---------------------------------------------------------------------------
// Relay mesh helpers (two-stack tests via Digital Ocean relays)
// ---------------------------------------------------------------------------

const DO_RELAYS = [
  { id: "ws:relay1", relayKeyId: "ws:relay1", host: "r1.rezprotocol.io", port: 8443, tls: true, directoryUrl: "https://r1.rezprotocol.io" },
  { id: "ws:relay2", relayKeyId: "ws:relay2", host: "r2.rezprotocol.io", port: 8443, tls: true, directoryUrl: "https://r2.rezprotocol.io" },
  { id: "ws:relay3", relayKeyId: "ws:relay3", host: "r3.rezprotocol.io", port: 8443, tls: true, directoryUrl: "https://r3.rezprotocol.io" },
];

async function launchTwoStacks(t) {
  // Enable gateway/route debug logs for relay mesh diagnostics
  const prevGwDebug = process.env.REZ_GW_DEBUG;
  const prevRouteDebug = process.env.REZ_ROUTE_DEBUG;
  process.env.REZ_GW_DEBUG = "1";
  process.env.REZ_ROUTE_DEBUG = "1";
  t.after(() => {
    if (prevGwDebug == null) delete process.env.REZ_GW_DEBUG;
    else process.env.REZ_GW_DEBUG = prevGwDebug;
    if (prevRouteDebug == null) delete process.env.REZ_ROUTE_DEBUG;
    else process.env.REZ_ROUTE_DEBUG = prevRouteDebug;
  });

  const [stackA, stackB] = await Promise.all([
    startRezStack({ debug: true, knownRelays: DO_RELAYS }),
    startRezStack({ debug: true, knownRelays: DO_RELAYS }),
  ]);
  t.after(async () => {
    await stackA.stop();
    await stackB.stop();
  });

  const playwright = await import("playwright-core");
  const browser = await playwright.chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
  });
  t.after(async () => {
    await browser.close().catch(() => {});
  });

  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();

  const setupPageLogging = (page, label) => {
    page.on("pageerror", (err) => {
      // eslint-disable-next-line no-console
      console.error("[" + label + ":pageerror] " + (err && err.message ? err.message : String(err)));
    });
    if (String(process.env.REZ_E2E_DEBUG || "") === "1") {
      page.on("console", (msg) => {
        // eslint-disable-next-line no-console
        console.error(`[${label}:${msg.type()}] ${msg.text()}`);
      });
    }
  };
  setupPageLogging(pageA, "stackA");
  setupPageLogging(pageB, "stackB");

  return { stackA, stackB, browser, contextA, contextB, pageA, pageB };
}

// ---------------------------------------------------------------------------
// Tests — relay mesh (two stacks peered via Digital Ocean relays)
// ---------------------------------------------------------------------------

test("e2e [relay]: DM invite accept + thread creation across two nodes", async (t) => {
  runPreflight();
  const { stackA, stackB, pageA, pageB } = await launchTwoStacks(t);

  // Bootstrap both stacks — create accounts in parallel
  await pageA.goto(stackA.shellUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await pageB.goto(stackB.shellUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await Promise.all([
    unlockViaUi(pageA, "relayA"),
    unlockViaUi(pageB, "relayB"),
  ]);

  const accountIdA = await getAccountId(pageA);
  const accountIdB = await getAccountId(pageB);
  assert.ok(accountIdA.length > 0, "Stack A accountId should be non-empty");
  assert.ok(accountIdB.length > 0, "Stack B accountId should be non-empty");
  assert.notEqual(accountIdA, accountIdB, "two stacks should have different accountIds");

  // Give relay mesh time to connect, register inboxes, and run initial discovery
  // eslint-disable-next-line no-console
  console.error("[DIAG] waiting 10s for relay mesh to settle...");
  await new Promise((r) => setTimeout(r, 10000));

  // Stack A creates a DM invite
  await pageA.getByTestId("nav.contacts").click();
  await pageA.waitForSelector("[data-testid='contacts.view']", { timeout: 15000 });
  await pageA.getByTestId("contacts.subtab.invites").click();
  await pageA.getByTestId("invite.create.dm").click();

  try {
    await pageA.waitForFunction(function() {
      var el = document.querySelector("[data-testid='invite.code']");
      var code = el ? String(el.textContent || "").trim() : "";
      return code.length > 0 && code.indexOf("(no invite yet)") === -1;
    }, null, { timeout: 20000 });
  } catch (err) {
    const dump = await dumpPageDebug(pageA, "relay-invite-create");
    throw new Error("invite create timeout on stack A; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  const inviteCode = String(await pageA.getByTestId("invite.code").textContent() || "").trim();
  assert.ok(inviteCode.length > 0, "invite code should be non-empty");
  // eslint-disable-next-line no-console
  console.error(`[DIAG] invite code: "${inviteCode}"`);

  // Stack B accepts the invite
  await pageB.getByTestId("nav.contacts").click();
  await pageB.waitForSelector("[data-testid='contacts.view']", { timeout: 15000 });
  await pageB.getByTestId("contacts.subtab.invites").click();
  await pageB.locator("[data-testid='invite.input']").fill(inviteCode);
  await pageB.getByTestId("invite.confirm").click();

  // Check status at multiple intervals to see what the invite accept does
  for (const waitSec of [5, 35]) {
    await new Promise((r) => setTimeout(r, waitSec * 1000));
    const diagB = await pageB.evaluate(() => {
      const s = document.querySelector("[data-testid='chat.connected']");
      const a = document.querySelector("[data-testid='chat.alert.banner']");
      const e = document.querySelector("[data-testid='auth.error']");
      const threads = document.querySelectorAll("[data-testid='chat.list.item']");
      return {
        status: String(s && s.textContent || ""),
        alert: String(a && a.textContent || ""),
        authError: String(e && e.textContent || ""),
        threadCount: threads.length,
      };
    }).catch(() => ({ status: "(eval failed)", alert: "", authError: "", threadCount: 0 }));
    // eslint-disable-next-line no-console
    console.error(`[DIAG] ${waitSec}s after accept: status="${diagB.status}" alert="${diagB.alert}" authError="${diagB.authError}" threads=${diagB.threadCount}`);
    if (diagB.threadCount > 0) break;
  }

  // After accept, UI switches to chat tab — wait for a thread to appear on Stack B
  // Relay mesh claim + handshake can take 30-60s
  try {
    await pageB.waitForFunction(() => {
      const items = document.querySelectorAll("[data-testid='chat.list.item']");
      return items.length > 0;
    }, null, { timeout: 60000 });
  } catch (err) {
    const statusB = await pageB.evaluate(() => {
      const s = document.querySelector("[data-testid='chat.connected']");
      const a = document.querySelector("[data-testid='chat.alert.banner']");
      return { status: String(s && s.textContent || ""), alert: String(a && a.textContent || "") };
    }).catch(() => ({ status: "(eval failed)", alert: "" }));
    const dump = await dumpPageDebug(pageB, "relay-invite-accept-B");
    throw new Error("thread did not appear on stack B after invite accept; status=\"" + statusB.status + "\"; alert=\"" + statusB.alert + "\"; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  const threadCountB = await pageB.locator("[data-testid='chat.list.item']").count();
  assert.ok(threadCountB > 0, "Stack B should have at least one thread after accepting invite");

  // Stack A should also see the thread — navigate to chat tab
  await pageA.getByTestId("nav.chat").click();
  try {
    await pageA.waitForFunction(() => {
      const items = document.querySelectorAll("[data-testid='chat.list.item']");
      return items.length > 0;
    }, null, { timeout: 90000 });
  } catch (err) {
    const dump = await dumpPageDebug(pageA, "relay-thread-appear-A");
    throw new Error("thread did not appear on stack A after invite accept; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  const threadCountA = await pageA.locator("[data-testid='chat.list.item']").count();
  assert.ok(threadCountA > 0, "Stack A should have at least one thread after peer link established");
});

test("e2e [relay]: cross-node message delivery", async (t) => {
  runPreflight();
  const { stackA, stackB, pageA, pageB } = await launchTwoStacks(t);

  // Bootstrap both stacks
  await pageA.goto(stackA.shellUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await pageB.goto(stackB.shellUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await Promise.all([
    unlockViaUi(pageA, "msgA"),
    unlockViaUi(pageB, "msgB"),
  ]);

  // Stack A creates invite, Stack B accepts
  await pageA.getByTestId("nav.contacts").click();
  await pageA.waitForSelector("[data-testid='contacts.view']", { timeout: 15000 });
  await pageA.getByTestId("contacts.subtab.invites").click();
  await pageA.getByTestId("invite.create.dm").click();
  await pageA.waitForFunction(function() {
    var el = document.querySelector("[data-testid='invite.code']");
    var code = el ? String(el.textContent || "").trim() : "";
    return code.length > 0 && code.indexOf("(no invite yet)") === -1;
  }, null, { timeout: 20000 });
  const inviteCode = String(await pageA.getByTestId("invite.code").textContent() || "").trim();

  await pageB.getByTestId("nav.contacts").click();
  await pageB.waitForSelector("[data-testid='contacts.view']", { timeout: 15000 });
  await pageB.getByTestId("contacts.subtab.invites").click();
  await pageB.locator("[data-testid='invite.input']").fill(inviteCode);
  await pageB.getByTestId("invite.confirm").click();

  // Wait for thread on both stacks (relay mesh routing can take 30-60s)
  await pageB.waitForFunction(() => {
    const items = document.querySelectorAll("[data-testid='chat.list.item']");
    return items.length > 0;
  }, null, { timeout: 90000 });

  await pageA.getByTestId("nav.chat").click();
  await pageA.waitForFunction(() => {
    const items = document.querySelectorAll("[data-testid='chat.list.item']");
    return items.length > 0;
  }, null, { timeout: 90000 });

  // Stack A clicks thread to open it
  await pageA.locator("[data-testid='chat.list.item']").first().click();
  await pageA.waitForSelector("[data-testid='thread.messages']", { timeout: 15000 });

  // Stack A sends a message
  const testMessage = `e2e-relay-msg-${Date.now()}`;
  await pageA.locator("[data-testid='composer.input']").fill(testMessage);
  await pageA.getByTestId("composer.send").click();

  // Wait for the message to appear on Stack A's timeline
  try {
    await pageA.waitForFunction((msg) => {
      const el = document.querySelector("[data-testid='thread.messages']");
      return el && el.textContent.includes(msg);
    }, testMessage, { timeout: 15000 });
  } catch (err) {
    const dump = await dumpPageDebug(pageA, "relay-msg-send-A");
    throw new Error("message not shown on stack A timeline; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  // Stack B opens the thread
  await pageB.locator("[data-testid='chat.list.item']").first().click();
  await pageB.waitForSelector("[data-testid='thread.messages']", { timeout: 15000 });

  // Wait for the message to appear on Stack B's timeline
  try {
    await pageB.waitForFunction((msg) => {
      const el = document.querySelector("[data-testid='thread.messages']");
      return el && el.textContent.includes(msg);
    }, testMessage, { timeout: 45000 });
  } catch (err) {
    const dump = await dumpPageDebug(pageB, "relay-msg-recv-B");
    throw new Error("message not delivered to stack B; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  const timelineTextB = await pageB.evaluate(function() {
    var el = document.querySelector("[data-testid='thread.messages']");
    return el ? String(el.textContent || "") : "";
  });
  assert.ok(timelineTextB.includes(testMessage), "Stack B timeline should contain the message sent from Stack A");

  // --- B-to-A direction: Stack B sends a reply ---
  const replyMessage = `e2e-reply-${Date.now()}`;
  await pageB.locator("[data-testid='composer.input']").fill(replyMessage);
  await pageB.getByTestId("composer.send").click();

  // Wait for the reply to appear on Stack B's timeline
  try {
    await pageB.waitForFunction((msg) => {
      const el = document.querySelector("[data-testid='thread.messages']");
      return el && el.textContent.includes(msg);
    }, replyMessage, { timeout: 15000 });
  } catch (err) {
    const dump = await dumpPageDebug(pageB, "relay-reply-send-B");
    throw new Error("reply not shown on stack B timeline; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  // Wait for the reply to appear on Stack A's timeline
  try {
    await pageA.waitForFunction((msg) => {
      const el = document.querySelector("[data-testid='thread.messages']");
      return el && el.textContent.includes(msg);
    }, replyMessage, { timeout: 45000 });
  } catch (err) {
    const dump = await dumpPageDebug(pageA, "relay-reply-recv-A");
    throw new Error("reply not delivered to stack A; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  const timelineTextA = await pageA.evaluate(function() {
    var el = document.querySelector("[data-testid='thread.messages']");
    return el ? String(el.textContent || "") : "";
  });
  assert.ok(timelineTextA.includes(replyMessage), "Stack A timeline should contain the reply sent from Stack B");
});

// ---------------------------------------------------------------------------
// Deferred — require additional implementation or complex setup
// ---------------------------------------------------------------------------

test.skip("e2e [relay]: contacts block/unblock gates outbound send", async () => {});
test("e2e [relay]: restart rehydrates threads/messages after reconnect", async (t) => {
  runPreflight();
  const { stackA, stackB, pageA, pageB } = await launchTwoStacks(t);

  // --- Phase 1: Bootstrap both stacks ---
  await pageA.goto(stackA.shellUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await pageB.goto(stackB.shellUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await Promise.all([
    unlockViaUi(pageA, "persistA"),
    unlockViaUi(pageB, "persistB"),
  ]);

  const accountIdBefore = await getAccountId(pageA);
  assert.ok(accountIdBefore.length > 0, "Stack A accountId should be non-empty");

  // Give relay mesh time to settle
  await new Promise((r) => setTimeout(r, 10000));

  // --- Phase 2: Create DM (A invites, B accepts) ---
  await pageA.getByTestId("nav.contacts").click();
  await pageA.waitForSelector("[data-testid='contacts.view']", { timeout: 15000 });
  await pageA.getByTestId("contacts.subtab.invites").click();
  await pageA.getByTestId("invite.create.dm").click();

  try {
    await pageA.waitForFunction(function() {
      var el = document.querySelector("[data-testid='invite.code']");
      var code = el ? String(el.textContent || "").trim() : "";
      return code.length > 0 && code.indexOf("(no invite yet)") === -1;
    }, null, { timeout: 20000 });
  } catch (err) {
    var dump = await dumpPageDebug(pageA, "persist-invite-create");
    throw new Error("invite create timeout; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  var inviteCode = String(await pageA.getByTestId("invite.code").textContent() || "").trim();
  assert.ok(inviteCode.length > 0, "invite code should be non-empty");

  // Stack B accepts the invite
  await pageB.getByTestId("nav.contacts").click();
  await pageB.waitForSelector("[data-testid='contacts.view']", { timeout: 15000 });
  await pageB.getByTestId("contacts.subtab.invites").click();
  await pageB.locator("[data-testid='invite.input']").fill(inviteCode);
  await pageB.getByTestId("invite.confirm").click();

  // Wait for thread to appear on Stack B
  try {
    await pageB.waitForFunction(function() {
      var items = document.querySelectorAll("[data-testid='chat.list.item']");
      return items.length > 0;
    }, null, { timeout: 60000 });
  } catch (err) {
    var dump = await dumpPageDebug(pageB, "persist-invite-accept-B");
    throw new Error("thread did not appear on stack B; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  // Wait for thread to appear on Stack A
  await pageA.getByTestId("nav.chat").click();
  try {
    await pageA.waitForFunction(function() {
      var items = document.querySelectorAll("[data-testid='chat.list.item']");
      return items.length > 0;
    }, null, { timeout: 90000 });
  } catch (err) {
    var dump = await dumpPageDebug(pageA, "persist-thread-appear-A");
    throw new Error("thread did not appear on stack A; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  // --- Phase 3: Send a message from Stack A ---
  await pageA.locator("[data-testid='chat.list.item']").first().click();
  var testMessage = "persist-test-" + Date.now();
  await pageA.locator("[data-testid='composer.input']").fill(testMessage);
  await pageA.getByTestId("composer.send").click();

  try {
    await pageA.waitForFunction(function(msg) {
      var el = document.querySelector("[data-testid='thread.messages']");
      return el && el.textContent.includes(msg);
    }, testMessage, { timeout: 15000 });
  } catch (err) {
    var dump = await dumpPageDebug(pageA, "persist-msg-send-A");
    throw new Error("message not shown on stack A; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  // Capture pre-restart state
  var threadCountBefore = await pageA.locator("[data-testid='chat.list.item']").count();
  assert.ok(threadCountBefore > 0, "Stack A should have threads before restart");

  // --- Phase 4: Restart Stack A ---
  await stackA.restart();

  // --- Phase 5: Reload, unlock, and verify persistence ---
  await pageA.goto(stackA.shellUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await unlockViaUi(pageA, "persistA");

  var accountIdAfter = await getAccountId(pageA);
  assert.equal(accountIdAfter, accountIdBefore, "accountId should be preserved across restart");

  // Thread list should be populated after restart
  try {
    await pageA.waitForFunction(function() {
      var items = document.querySelectorAll("[data-testid='chat.list.item']");
      return items.length > 0;
    }, null, { timeout: 30000 });
  } catch (err) {
    var dump = await dumpPageDebug(pageA, "persist-threads-after-restart");
    throw new Error("threads not restored after restart; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  var threadCountAfter = await pageA.locator("[data-testid='chat.list.item']").count();
  assert.ok(threadCountAfter >= threadCountBefore, "thread count should be preserved after restart (before=" + threadCountBefore + " after=" + threadCountAfter + ")");

  // Click into the thread and verify the message survived
  await pageA.locator("[data-testid='chat.list.item']").first().click();

  try {
    await pageA.waitForFunction(function(msg) {
      var el = document.querySelector("[data-testid='thread.messages']");
      return el && el.textContent.includes(msg);
    }, testMessage, { timeout: 15000 });
  } catch (err) {
    var dump = await dumpPageDebug(pageA, "persist-msg-after-restart");
    throw new Error("message not found after restart; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  var timelineText = await pageA.evaluate(function() {
    var el = document.querySelector("[data-testid='thread.messages']");
    return el ? String(el.textContent || "") : "";
  });
  assert.ok(timelineText.includes(testMessage), "message text should be preserved after restart");
});

test("e2e [relay]: group create → invite → accept → cross-node message", async (t) => {
  runPreflight();
  const { stackA, stackB, pageA, pageB } = await launchTwoStacks(t);

  // Bootstrap both stacks
  await pageA.goto(stackA.shellUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await pageB.goto(stackB.shellUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await Promise.all([
    unlockViaUi(pageA, "grpA"),
    unlockViaUi(pageB, "grpB"),
  ]);

  const accountIdA = await getAccountId(pageA);
  const accountIdB = await getAccountId(pageB);
  assert.ok(accountIdA.length > 0, "Stack A accountId should be non-empty");
  assert.ok(accountIdB.length > 0, "Stack B accountId should be non-empty");

  // Give relay mesh time to settle
  // eslint-disable-next-line no-console
  console.error("[DIAG] waiting 10s for relay mesh to settle...");
  await new Promise((r) => setTimeout(r, 10000));

  // --- Phase 1: Stack A creates a group invite ---
  await pageA.getByTestId("nav.contacts").click();
  await pageA.waitForSelector("[data-testid='contacts.view']", { timeout: 15000 });
  await pageA.getByTestId("contacts.subtab.invites").click();

  // Fill group name and click create
  await pageA.locator("[data-testid='contacts.group.title']").fill("E2E Test Group");
  await pageA.getByTestId("invite.create.group").click();

  // Wait for invite code to appear
  try {
    await pageA.waitForFunction(function() {
      var el = document.querySelector("[data-testid='invite.code']");
      var code = el ? String(el.textContent || "").trim() : "";
      return code.length > 0 && code.indexOf("(no invite yet)") === -1;
    }, null, { timeout: 20000 });
  } catch (err) {
    var dump = await dumpPageDebug(pageA, "group-invite-create");
    throw new Error("group invite create timeout; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  var inviteCode = String(await pageA.getByTestId("invite.code").textContent() || "").trim();
  assert.ok(inviteCode.length > 0, "group invite code should be non-empty");
  // eslint-disable-next-line no-console
  console.error("[DIAG] group invite code: \"" + inviteCode + "\"");

  // --- Phase 2: Stack B accepts the group invite ---
  await pageB.getByTestId("nav.contacts").click();
  await pageB.waitForSelector("[data-testid='contacts.view']", { timeout: 15000 });
  await pageB.getByTestId("contacts.subtab.invites").click();
  await pageB.locator("[data-testid='invite.input']").fill(inviteCode);
  await pageB.getByTestId("invite.confirm").click();

  // Wait for thread to appear on Stack B
  try {
    await pageB.waitForFunction(function() {
      var items = document.querySelectorAll("[data-testid='chat.list.item']");
      return items.length > 0;
    }, null, { timeout: 90000 });
  } catch (err) {
    var dump = await dumpPageDebug(pageB, "group-invite-accept-B");
    throw new Error("thread did not appear on stack B after group invite accept; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  var threadCountB = await pageB.locator("[data-testid='chat.list.item']").count();
  assert.ok(threadCountB > 0, "Stack B should have at least one thread after accepting group invite");

  // Wait for thread to appear on Stack A
  await pageA.getByTestId("nav.chat").click();
  try {
    await pageA.waitForFunction(function() {
      var items = document.querySelectorAll("[data-testid='chat.list.item']");
      return items.length > 0;
    }, null, { timeout: 90000 });
  } catch (err) {
    var dump = await dumpPageDebug(pageA, "group-thread-appear-A");
    throw new Error("thread did not appear on stack A; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  // --- Phase 3: Stack A sends a message to the group ---
  await pageA.locator("[data-testid='chat.list.item']").first().click();
  await pageA.waitForSelector("[data-testid='thread.messages']", { timeout: 15000 });

  var testMessage = "e2e-group-msg-" + Date.now();
  await pageA.locator("[data-testid='composer.input']").fill(testMessage);
  await pageA.getByTestId("composer.send").click();

  // Wait for message on Stack A's timeline
  try {
    await pageA.waitForFunction(function(msg) {
      var el = document.querySelector("[data-testid='thread.messages']");
      return el && el.textContent.includes(msg);
    }, testMessage, { timeout: 15000 });
  } catch (err) {
    var dump = await dumpPageDebug(pageA, "group-msg-send-A");
    throw new Error("group message not shown on stack A; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  // --- Phase 4: Stack B receives the group message ---
  await pageB.locator("[data-testid='chat.list.item']").first().click();
  await pageB.waitForSelector("[data-testid='thread.messages']", { timeout: 15000 });

  try {
    await pageB.waitForFunction(function(msg) {
      var el = document.querySelector("[data-testid='thread.messages']");
      return el && el.textContent.includes(msg);
    }, testMessage, { timeout: 45000 });
  } catch (err) {
    var dump = await dumpPageDebug(pageB, "group-msg-recv-B");
    throw new Error("group message not delivered to stack B; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  var timelineTextB = await pageB.evaluate(function() {
    var el = document.querySelector("[data-testid='thread.messages']");
    return el ? String(el.textContent || "") : "";
  });
  assert.ok(timelineTextB.includes(testMessage), "Stack B timeline should contain the group message from Stack A");

  // --- Phase 5: Stack B replies to the group ---
  var replyMessage = "e2e-group-reply-" + Date.now();
  await pageB.locator("[data-testid='composer.input']").fill(replyMessage);
  await pageB.getByTestId("composer.send").click();

  try {
    await pageB.waitForFunction(function(msg) {
      var el = document.querySelector("[data-testid='thread.messages']");
      return el && el.textContent.includes(msg);
    }, replyMessage, { timeout: 15000 });
  } catch (err) {
    var dump = await dumpPageDebug(pageB, "group-reply-send-B");
    throw new Error("group reply not shown on stack B; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  // Stack A should receive the reply
  try {
    await pageA.waitForFunction(function(msg) {
      var el = document.querySelector("[data-testid='thread.messages']");
      return el && el.textContent.includes(msg);
    }, replyMessage, { timeout: 45000 });
  } catch (err) {
    var dump = await dumpPageDebug(pageA, "group-reply-recv-A");
    throw new Error("group reply not delivered to stack A; screenshot=" + dump.screenshotPath + "; cause=" + (err && err.message ? err.message : err));
  }

  var timelineTextA = await pageA.evaluate(function() {
    var el = document.querySelector("[data-testid='thread.messages']");
    return el ? String(el.textContent || "") : "";
  });
  assert.ok(timelineTextA.includes(replyMessage), "Stack A timeline should contain the group reply from Stack B");
});
