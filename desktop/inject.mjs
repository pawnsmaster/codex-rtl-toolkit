import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import WebSocket from "ws";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const portArg = process.argv.find((arg) => arg.startsWith("--port="));
const port = Number(portArg?.split("=")[1] || process.env.CODEX_RTL_PORT || 9223);

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("CODEX_RTL_PORT must be an integer between 1024 and 65535.");
}

const css = readFileSync(resolve(root, "src", "rtl-style.css"), "utf8");
const injected = readFileSync(resolve(root, "src", "injected.js"), "utf8");

if (dryRun) {
  if (!css.includes("unicode-bidi") || !injected.includes("MutationObserver")) {
    throw new Error("RTL assets look incomplete.");
  }
  console.log("OK: RTL assets are present.");
  process.exit(0);
}

const endpoint = `http://127.0.0.1:${port}/json`;

async function getTargets() {
  let response;
  try {
    response = await fetch(endpoint);
  } catch (error) {
    throw new Error(`Cannot reach ${endpoint}. Start Codex with desktop/Launch-CodexRTL.ps1 first.`);
  }
  if (!response.ok) {
    throw new Error(`DevTools endpoint returned HTTP ${response.status}.`);
  }
  return response.json();
}

function isLikelyCodexTarget(target) {
  const haystack = `${target.title || ""} ${target.url || ""}`.toLowerCase();
  return target.webSocketDebuggerUrl && (
    haystack.includes("codex") ||
    haystack.includes("chatgpt") ||
    haystack.includes("chatgpt.com") ||
    haystack.includes("app://")
  );
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function waitForCandidates(timeoutMilliseconds = 30000) {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError = new Error("No Codex/ChatGPT-like renderer target found yet.");

  do {
    try {
      const targets = await getTargets();
      const candidates = targets.filter(isLikelyCodexTarget);
      if (candidates.length > 0) {
        return candidates;
      }
      lastError = new Error("No Codex/ChatGPT-like renderer target found. Open a conversation and try again.");
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  } while (Date.now() < deadline);

  throw lastError;
}

function assertLocalDevToolsUrl(wsUrl) {
  const url = new URL(wsUrl);
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)) {
    throw new Error(`Refusing non-local DevTools target: ${url.hostname}`);
  }
}

function evaluate(wsUrl, expression) {
  assertLocalDevToolsUrl(wsUrl);
  return new Promise((resolvePromise, rejectPromise) => {
    const ws = new WebSocket(wsUrl);
    const id = 1;
    const timeout = setTimeout(() => {
      ws.close();
      rejectPromise(new Error("Timed out while injecting CSS."));
    }, 8000);

    ws.on("open", () => {
      ws.send(JSON.stringify({
        id,
        method: "Runtime.evaluate",
        params: {
          expression,
          awaitPromise: false,
          returnByValue: true
        }
      }));
    });

    ws.on("message", (data) => {
      const message = JSON.parse(String(data));
      if (message.id !== id) return;
      clearTimeout(timeout);
      ws.close();
      if (message.error || message.result?.exceptionDetails) {
        rejectPromise(new Error(JSON.stringify(message.error || message.result.exceptionDetails)));
      } else {
        resolvePromise(message.result);
      }
    });

    ws.on("error", (error) => {
      clearTimeout(timeout);
      rejectPromise(error);
    });
  });
}

const candidates = await waitForCandidates();

const expression = `
(() => {
  window.__CODEX_RTL_STYLE__ = ${JSON.stringify(css)};
  const source = ${JSON.stringify(injected)};
  (0, eval)(source);
  return Boolean(window.__CODEX_RTL_ACTIVE__);
})()
`;

for (const target of candidates) {
  await evaluate(target.webSocketDebuggerUrl, expression);
  console.log(`Injected RTL fix into: ${target.title || target.url}`);
}
