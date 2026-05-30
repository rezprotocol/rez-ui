import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

let buildOncePromise = null;
const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "../../../..");

async function ensureRezChatBuild() {
  if (buildOncePromise) return buildOncePromise;
  buildOncePromise = runBuild();
  try {
    await buildOncePromise;
  } catch (err) {
    buildOncePromise = null;
    throw err;
  }
  return buildOncePromise;
}

async function runBuild() {
  await new Promise((resolve, reject) => {
    const child = spawn("npm", ["-w", "rez-chat", "run", "build"], {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`rez-chat build failed with exit code ${code}`));
    });
  });
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
  });
}

async function waitForHttpReady(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.get(url, { timeout: 1000 }, (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      });
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.on("error", () => resolve(false));
    });
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`HTTP readiness timeout for ${url}`);
}

async function waitForWsPortReady(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const socket = net.createConnection({ host: "127.0.0.1", port }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
      socket.setTimeout(1000, () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`WS readiness timeout for 127.0.0.1:${port}`);
}

async function waitForShellConfig(baseUrl, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const json = await new Promise((resolve, reject) => {
        const req = http.get(`${baseUrl}/config`, { timeout: 1200 }, (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 500) {
              reject(new Error(`Unexpected status ${res.statusCode}`));
              return;
            }
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch (err) {
              reject(err);
            }
          });
        });
        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy(new Error("timeout"));
        });
      });
      if (json && typeof json.wsUrl === "string" && json.wsUrl.trim().length > 0) {
        return json;
      }
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Shell config readiness timeout for ${baseUrl}/config`);
}

function wsPortFromUrl(wsUrl) {
  try {
    const parsed = new URL(wsUrl);
    return Number.parseInt(parsed.port, 10);
  } catch {
    return NaN;
  }
}

async function createTempRezChatConfig({ wsPort, knownRelays = [] } = {}) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "rez-ui-e2e-"));
  const configPath = path.join(rootDir, "rez.config.json");
  const dataDir = path.join(rootDir, "node-data");

  const config = {
    node: {
      ws: {
        host: "127.0.0.1",
        port: Number(wsPort),
        path: "/ws",
      },
      storage: {
        dataDir,
        defaultThreadId: "th_e2e_default_thread",
      },
      network: {
        participateInRouting: true,
        knownRelays: Array.isArray(knownRelays) ? knownRelays : [],
      },
    },
  };

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  return {
    rootDir,
    configPath,
    async cleanup() {
      await fs.rm(rootDir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

function terminateProcess(child, timeoutMs = 6000) {
  return new Promise((resolve) => {
    if (!child || child.exitCode != null) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    child.once("exit", finish);
    child.kill("SIGTERM");
    setTimeout(() => {
      if (done) return;
      child.kill("SIGKILL");
      finish();
    }, timeoutMs).unref?.();
  });
}

export async function startRezStack({ debug = false, knownRelays = [] } = {}) {
  await ensureRezChatBuild();
  const wsPort = await getFreePort();
  const shellPort = await getFreePort();
  const fixture = await createTempRezChatConfig({ wsPort, knownRelays });

  let child = null;
  let currentWsUrl = `ws://127.0.0.1:${wsPort}/ws`;
  const previousDebug = process.env.REZ_E2E_DEBUG;
  let stopped = false;
  if (debug === true) {
    process.env.REZ_E2E_DEBUG = "1";
  }

  async function startApp() {
    child = spawn("npm", ["-w", "rez-chat", "run", "start"], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CHAT_PORT: String(shellPort),
        CHAT_BIND_HOST: "127.0.0.1",
        REZ_NODE_WS_PORT: String(wsPort),
        REZ_NODE_DATA_DIR: path.join(fixture.rootDir, "node-data"),
        REZ_CHAT_CONFIG_PATH: fixture.configPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (debug) {
      child.stdout?.on("data", (chunk) => process.stdout.write(`[rez-stack] ${chunk}`));
      child.stderr?.on("data", (chunk) => process.stderr.write(`[rez-stack] ${chunk}`));
    }

    child.once("exit", (code, signal) => {
      if (!stopped && code !== 0) {
        process.stderr.write(`[rez-stack] rez-chat exited code=${code} signal=${signal}\n`);
      }
    });

    await waitForHttpReady(`http://127.0.0.1:${shellPort}`);
    const cfg = await waitForShellConfig(`http://127.0.0.1:${shellPort}`);
    const wsUrl = String(cfg.wsUrl || "").trim();
    if (!wsUrl) throw new Error("rez-chat /config missing wsUrl");
    const parsedWsPort = wsPortFromUrl(wsUrl);
    if (!Number.isInteger(parsedWsPort) || parsedWsPort <= 0) {
      throw new Error(`Invalid wsUrl from /config: ${wsUrl}`);
    }
    await waitForWsPortReady(parsedWsPort);
    currentWsUrl = wsUrl;
  }

  async function stopAppOnly() {
    const running = child;
    child = null;
    await terminateProcess(running);
  }

  async function finalize() {
    if (stopped) return;
    stopped = true;
    await stopAppOnly();
    await fixture.cleanup();
    if (debug === true) {
      if (previousDebug == null) delete process.env.REZ_E2E_DEBUG;
      else process.env.REZ_E2E_DEBUG = previousDebug;
    }
  }

  try {
    await startApp();
  } catch (err) {
    await finalize();
    throw err;
  }

  return {
    get dataDir() {
      return path.join(fixture.rootDir, "node-data");
    },
    get configPath() {
      return fixture.configPath;
    },
    get shellUrl() {
      return `http://127.0.0.1:${shellPort}`;
    },
    get wsUrl() {
      return currentWsUrl;
    },
    get wsPort() {
      return wsPort;
    },
    async restart() {
      const expectedDataDir = path.join(fixture.rootDir, "node-data");
      await stopAppOnly();
      await startApp();
      const actualDataDir = fixture?.rootDir ? path.join(fixture.rootDir, "node-data") : "";
      if (actualDataDir !== expectedDataDir) {
        throw new Error(`restart dataDir mismatch: expected=${expectedDataDir} actual=${actualDataDir}`);
      }
    },
    async stop() {
      await finalize();
    },
  };
}
