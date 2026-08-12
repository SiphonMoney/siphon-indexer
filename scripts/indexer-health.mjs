import { decodeFunctionResult, encodeFunctionData } from "viem";
import { fileURLToPath } from "node:url";

const GET_SIZE_ABI = [
  {
    type: "function",
    name: "getSize",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getRoot",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
];

export function healthTargetsForScope(scope, env = process.env) {
  if (scope === "base") {
    return [
      { chainId: 8453, asset: "ETH", tree: env.MERKLE_TREE_BASE_ETH, rpc: env.PONDER_RPC_URL_8453 },
      { chainId: 8453, asset: "USDC", tree: env.MERKLE_TREE_BASE_USDC, rpc: env.PONDER_RPC_URL_8453 },
    ];
  }
  if (scope === "sepolia") {
    return [
      { chainId: 11155111, asset: "ETH", tree: env.MERKLE_TREE_SEPOLIA_ETH, rpc: env.PONDER_RPC_URL_11155111 },
      { chainId: 11155111, asset: "USDC", tree: env.MERKLE_TREE_SEPOLIA_USDC, rpc: env.PONDER_RPC_URL_11155111 },
    ];
  }
  throw new Error(`INDEXER_SCOPE must be base or sepolia, got ${scope || "<empty>"}`);
}

export function assessFreshness(indexed, onChainSize, onChainRoot) {
  if (!indexed?.contiguous) return { ok: false, reason: "indexed leaves are not contiguous" };
  if (indexed.totalCount !== onChainSize) {
    return { ok: false, reason: `indexed ${indexed.totalCount} of ${onChainSize} leaves` };
  }
  if (onChainSize > 0 && String(indexed.tipRoot) !== String(onChainRoot)) {
    return { ok: false, reason: "indexed tip root does not match chain" };
  }
  return { ok: true };
}

async function json(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function onChainState(target) {
  if (!target.rpc || !target.tree) throw new Error(`missing RPC/tree for ${target.asset}`);
  const call = async (functionName) => {
    const body = await json(target.rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [
          { to: target.tree, data: encodeFunctionData({ abi: GET_SIZE_ABI, functionName }) },
          "latest",
        ],
      }),
    });
    if (!body.result) throw new Error(body.error?.message || `${functionName} returned no result`);
    return body.result;
  };
  const sizeData = await call("getSize");
  const rootData = await call("getRoot");
  return {
    size: Number(decodeFunctionResult({ abi: GET_SIZE_ABI, functionName: "getSize", data: sizeData })),
    root: String(decodeFunctionResult({ abi: GET_SIZE_ABI, functionName: "getRoot", data: rootData })),
  };
}

export async function checkIndexerHealth(env = process.env) {
  const targets = healthTargetsForScope(env.INDEXER_SCOPE, env);
  for (const target of targets) {
    const indexed = await json(
      `http://127.0.0.1:42069/leaves?chainId=${target.chainId}&asset=${target.asset}&limit=1`,
    );
    const chain = await onChainState(target);
    const result = assessFreshness(indexed, chain.size, chain.root);
    if (!result.ok) throw new Error(`${target.chainId}/${target.asset}: ${result.reason}`);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  checkIndexerHealth().catch((error) => {
    console.error(`[indexer-health] ${error.message}`);
    process.exitCode = 1;
  });
}
