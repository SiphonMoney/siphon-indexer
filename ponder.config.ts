import { createConfig } from "ponder";
import { http, type Transport } from "viem";
import { MerkleTreeAbi } from "./abis/MerkleTree";
import { VaultAbi } from "./abis/Vault";
import { VeilClassicPoolAbi, VeilEntryAbi, VeilNovaPoolAbi } from "./abis/VeilMixer";
import {
  BASE_L2_STANDARD_BRIDGE,
  StandardBridgeAbi,
  TornadoClassicPoolAbi,
  bridgeStartBlock,
  indexBaseBridges,
} from "./abis/CrossChainGraph";
import {
  ACROSS_SPOKE_BASE,
  ACROSS_SPOKE_ETH,
  AcrossSpokePoolAbi,
  HOP_ETH_BASE_L2_BRIDGE,
  HOP_ETH_L1_BRIDGE,
  HOP_USDCE_BASE_L2_BRIDGE,
  HOP_USDCE_L1_BRIDGE,
  HopL1BridgeAbi,
  HopL2BridgeAbi,
  OftBridgeAbi,
  indexHopBridges,
  indexThirdPartyBridges,
  stargateBasePools,
  stargateEthPools,
  thirdPartyBridgeStartBlock,
} from "./abis/ThirdPartyBridges";
import { BASE_MIXER_POOLS, indexBaseMixers, mixerStartBlock } from "./src/mixerPools.base";
import { ETH_TORNADO_POOLS, ethMixerStartBlock, indexEthTornado } from "./src/mixerPools.eth";

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

const mixerContracts: Record<
  string,
  {
    abi:
      | typeof VeilEntryAbi
      | typeof VeilNovaPoolAbi
      | typeof VeilClassicPoolAbi
      | typeof TornadoClassicPoolAbi
      | typeof StandardBridgeAbi
      | typeof AcrossSpokePoolAbi
      | typeof OftBridgeAbi
      | typeof HopL1BridgeAbi
      | typeof HopL2BridgeAbi;
    chain: "base" | "ethereum";
    address: `0x${string}`;
    startBlock: number;
  }
> = {};

if (indexBaseMixers()) {
  for (const p of BASE_MIXER_POOLS) {
    const startBlock = mixerStartBlock(p.defaultStartBlock);
    if (p.kind === "veil_entry") {
      mixerContracts[p.id] = {
        abi: VeilEntryAbi,
        chain: "base",
        address: p.address,
        startBlock,
      };
    } else if (p.kind === "veil_nova") {
      mixerContracts[p.id] = {
        abi: VeilNovaPoolAbi,
        chain: "base",
        address: p.address,
        startBlock,
      };
    } else {
      mixerContracts[p.id] = {
        abi: VeilClassicPoolAbi,
        chain: "base",
        address: p.address,
        startBlock,
      };
    }
  }
}

if (indexBaseBridges()) {
  mixerContracts.BaseL2StandardBridge = {
    abi: StandardBridgeAbi,
    chain: "base",
    address: BASE_L2_STANDARD_BRIDGE,
    // Base genesis-ish; override with BASE_BRIDGE_START_BLOCK to limit backfill
    startBlock: bridgeStartBlock(1),
  };
}

if (indexEthTornado()) {
  for (const p of ETH_TORNADO_POOLS) {
    mixerContracts[p.id] = {
      abi: TornadoClassicPoolAbi,
      chain: "ethereum",
      address: p.address,
      startBlock: ethMixerStartBlock(p.defaultStartBlock),
    };
  }
}

if (indexThirdPartyBridges()) {
  const tpStart = thirdPartyBridgeStartBlock(15_000_000);
  const baseTpStart = thirdPartyBridgeStartBlock(10_000_000);
  mixerContracts.AcrossSpokeBase = {
    abi: AcrossSpokePoolAbi,
    chain: "base",
    address: ACROSS_SPOKE_BASE,
    startBlock: baseTpStart,
  };
  mixerContracts.AcrossSpokeEth = {
    abi: AcrossSpokePoolAbi,
    chain: "ethereum",
    address: ACROSS_SPOKE_ETH,
    startBlock: tpStart,
  };

  if (indexHopBridges()) {
    mixerContracts.HopEthL1 = {
      abi: HopL1BridgeAbi,
      chain: "ethereum",
      address: HOP_ETH_L1_BRIDGE,
      startBlock: tpStart,
    };
    mixerContracts.HopEthBaseL2 = {
      abi: HopL2BridgeAbi,
      chain: "base",
      address: HOP_ETH_BASE_L2_BRIDGE,
      startBlock: baseTpStart,
    };
    mixerContracts.HopUsdceL1 = {
      abi: HopL1BridgeAbi,
      chain: "ethereum",
      address: HOP_USDCE_L1_BRIDGE,
      startBlock: tpStart,
    };
    mixerContracts.HopUsdceBaseL2 = {
      abi: HopL2BridgeAbi,
      chain: "base",
      address: HOP_USDCE_BASE_L2_BRIDGE,
      startBlock: baseTpStart,
    };
  }

  stargateBasePools().forEach((address, i) => {
    mixerContracts[`StargateBase${i}`] = {
      abi: OftBridgeAbi,
      chain: "base",
      address,
      startBlock: baseTpStart,
    };
  });
  stargateEthPools().forEach((address, i) => {
    mixerContracts[`StargateEth${i}`] = {
      abi: OftBridgeAbi,
      chain: "ethereum",
      address,
      startBlock: tpStart,
    };
  });
}

const needEthereum = indexEthTornado() || indexThirdPartyBridges();

const chains: Record<
  string,
  { id: number; rpc: Transport; maxRequestsPerSecond: number }
> = {
  base: {
    id: 8453,
    rpc: cappedLogsTransport(req("PONDER_RPC_URL_8453")),
    maxRequestsPerSecond: parseInt(process.env.PONDER_MAX_RPS || "15", 10),
  },
  ethSepolia: {
    id: 11155111,
    rpc: cappedLogsTransport(
      req("PONDER_RPC_URL_11155111"),
      BigInt(process.env.SEPOLIA_LOG_MAXRANGE || "10"),
    ),
    maxRequestsPerSecond: parseInt(process.env.PONDER_MAX_RPS || "15", 10),
  },
};

if (needEthereum) {
  chains.ethereum = {
    id: 1,
    rpc: cappedLogsTransport(req("PONDER_RPC_URL_1")),
    maxRequestsPerSecond: parseInt(
      process.env.PONDER_MAX_RPS_ETH || process.env.PONDER_MAX_RPS || "10",
      10,
    ),
  };
}

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: req("DATABASE_URL"),
  },
  chains,
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
    ...mixerContracts,
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
