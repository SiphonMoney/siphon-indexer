import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_RETRY_MS = 15_000;

export function rpcUrlsForScope(scope, env = process.env) {
  if (scope === "base") return [env.PONDER_RPC_URL_8453].filter(Boolean);
  if (scope === "sepolia") return [env.PONDER_RPC_URL_11155111].filter(Boolean);
  throw new Error(`INDEXER_SCOPE must be base or sepolia, got ${scope || "<empty>"}`);
}

export function chainIdForScope(scope) {
  if (scope === "base") return 8453;
  if (scope === "sepolia") return 11155111;
  throw new Error(`INDEXER_SCOPE must be base or sepolia, got ${scope || "<empty>"}`);
}

export async function rpcReady(url, expectedChainId, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const body = await response.json();
    return (
      typeof body?.result === "string" &&
      body.result.toLowerCase() === `0x${expectedChainId.toString(16)}`
    );
  } catch {
    return false;
  }
}

function spawnPonder(signal) {
  return new Promise((resolve) => {
    const child = spawn("./node_modules/.bin/ponder", ["start"], {
      stdio: "inherit",
      env: process.env,
      signal,
    });
    child.on("error", () => resolve(1));
    child.on("exit", (code, childSignal) => resolve(childSignal ? 1 : code ?? 1));
  });
}

export async function runSupervisor(options = {}) {
  const signal = options.signal ?? new AbortController().signal;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const log = options.log ?? console.log;
  const checkRpc = options.checkRpc ?? rpcReady;
  const runPonder = options.runPonder ?? spawnPonder;
  const retryMs = options.retryMs ?? Number(process.env.INDEXER_RETRY_MS || DEFAULT_RETRY_MS);
  const scope = options.scope ?? process.env.INDEXER_SCOPE;
  const urls = options.urls ?? rpcUrlsForScope(scope, process.env);
  const expectedChainId = chainIdForScope(scope);
  if (urls.length !== 1) throw new Error(`Exactly one RPC is required for ${scope}`);

  while (!signal.aborted) {
    while (!signal.aborted && !(await checkRpc(urls[0], expectedChainId))) {
      log(`[indexer-supervisor] ${scope} RPC unavailable; retrying without exiting container`);
      await sleep(retryMs);
    }
    if (signal.aborted) break;

    log(`[indexer-supervisor] starting isolated ${scope} Ponder process`);
    const code = await runPonder(signal);
    if (signal.aborted) break;
    log(`[indexer-supervisor] Ponder exited (${code}); backing off before retry`);
    await sleep(retryMs);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  runSupervisor().catch((error) => {
    console.error("[indexer-supervisor] fatal configuration error", error);
    process.exitCode = 1;
  });
}
