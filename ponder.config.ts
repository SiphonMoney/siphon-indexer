import { createConfig } from "ponder";
import { http, type Transport } from "viem";
import { MerkleTreeAbi } from "./abis/MerkleTree";
import { VaultAbi } from "./abis/Vault";

/**
 * HTTP transport that splits eth_getLogs into ≤maxRange block windows. Free-tier RPCs cap the
 * range (dRPC 10k, 1rpc 50, free Alchemy 10) with error messages Ponder's retry helper doesn't
 * always recognize — one oversized request then kills the whole sync. Splitting client-side
 * makes the cap a non-issue on any provider that allows ~9k ranges.
 */
function cappedLogsTransport(url: string, maxRange = 9_000n): Transport {
  return (args) => {
    const inner = http(url)(args);
    return {
      ...inner,
      async request(req: { method: string; params?: unknown }): Promise<unknown> {
        const { method, params } = req;
        if (method === "eth_getLogs" && Array.isArray(params)) {
          const filter = params[0] as { fromBlock?: string; toBlock?: string };
          if (
            typeof filter?.fromBlock === "string" &&
            typeof filter?.toBlock === "string" &&
            filter.fromBlock.startsWith("0x") &&
            filter.toBlock.startsWith("0x")
          ) {
            const from = BigInt(filter.fromBlock);
            const to = BigInt(filter.toBlock);
            if (to >= from && to - from + 1n > maxRange) {
              const out: unknown[] = [];
              for (let f = from; f <= to; f += maxRange) {
                const t = f + maxRange - 1n < to ? f + maxRange - 1n : to;
                const part = (await inner.request({
                  method,
                  params: [
                    { ...filter, fromBlock: `0x${f.toString(16)}`, toBlock: `0x${t.toString(16)}` },
                  ],
                } as Parameters<typeof inner.request>[0])) as unknown[];
                out.push(...part);
              }
              return out;
            }
          }
        }
        return inner.request(req as Parameters<typeof inner.request>[0]);
      },
    };
  };
}

const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function reqAddress(name: string): `0x${string}` {
  return req(name) as `0x${string}`;
}

function block(name: string, fallback: number): number {
  const v = process.env[name]?.trim();
  return v ? parseInt(v, 10) : fallback;
}

// MerkleTree + Vault addresses — run `npm run resolve-addresses` to populate .env.local
const baseDeployBlock = block("BASE_DEPLOY_BLOCK", 47_815_995);
const sepoliaDeployBlock = block("SEPOLIA_DEPLOY_BLOCK", 11_130_700);

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: req("DATABASE_URL"),
  },
  chains: {
    base: {
      id: 8453,
      rpc: cappedLogsTransport(req("PONDER_RPC_URL_8453")),
      // Keep well under the RPC key's rate limit (Ponder defaults to 50/s per chain,
      // which 429s a shared/free Alchemy key when both chains backfill at once).
      maxRequestsPerSecond: parseInt(process.env.PONDER_MAX_RPS || "15", 10),
    },
    ethSepolia: {
      id: 11155111,
      rpc: cappedLogsTransport(req("PONDER_RPC_URL_11155111"), BigInt(process.env.SEPOLIA_LOG_MAXRANGE || "10")),
      maxRequestsPerSecond: parseInt(process.env.PONDER_MAX_RPS || "15", 10),
    },
  },
  contracts: {
    MerkleTreeBaseEth: {
      abi: MerkleTreeAbi,
      chain: "base",
      address: reqAddress("MERKLE_TREE_BASE_ETH"),
      startBlock: baseDeployBlock,
    },
    MerkleTreeBaseUsdc: {
      abi: MerkleTreeAbi,
      chain: "base",
      address: reqAddress("MERKLE_TREE_BASE_USDC"),
      startBlock: baseDeployBlock,
    },
    MerkleTreeSepoliaEth: {
      abi: MerkleTreeAbi,
      chain: "ethSepolia",
      address: reqAddress("MERKLE_TREE_SEPOLIA_ETH"),
      startBlock: sepoliaDeployBlock,
    },
    MerkleTreeSepoliaUsdc: {
      abi: MerkleTreeAbi,
      chain: "ethSepolia",
      address: reqAddress("MERKLE_TREE_SEPOLIA_USDC"),
      startBlock: sepoliaDeployBlock,
    },
    VaultBaseEth: {
      abi: VaultAbi,
      chain: "base",
      address: reqAddress("VAULT_BASE_ETH"),
      startBlock: baseDeployBlock,
    },
    VaultBaseUsdc: {
      abi: VaultAbi,
      chain: "base",
      address: reqAddress("VAULT_BASE_USDC"),
      startBlock: baseDeployBlock,
    },
    VaultSepoliaEth: {
      abi: VaultAbi,
      chain: "ethSepolia",
      address: reqAddress("VAULT_SEPOLIA_ETH"),
      startBlock: sepoliaDeployBlock,
    },
    VaultSepoliaUsdc: {
      abi: VaultAbi,
      chain: "ethSepolia",
      address: reqAddress("VAULT_SEPOLIA_USDC"),
      startBlock: sepoliaDeployBlock,
    },
  },
});

// Re-export for scripts
export const CHAIN_ASSET_MAP: Record<string, { chainId: number; asset: string }> = {
  MerkleTreeBaseEth: { chainId: 8453, asset: "ETH" },
  MerkleTreeBaseUsdc: { chainId: 8453, asset: "USDC" },
  MerkleTreeSepoliaEth: { chainId: 11155111, asset: "ETH" },
  MerkleTreeSepoliaUsdc: { chainId: 11155111, asset: "USDC" },
  VaultBaseEth: { chainId: 8453, asset: "ETH" },
  VaultBaseUsdc: { chainId: 8453, asset: "USDC" },
  VaultSepoliaEth: { chainId: 11155111, asset: "ETH" },
  VaultSepoliaUsdc: { chainId: 11155111, asset: "USDC" },
};

export const NATIVE_TOKEN = NATIVE;
