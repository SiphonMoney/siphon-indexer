/**
 * Third-party bridges for ETH↔Base association — Across, Hop, Stargate OFT.
 *
 * Stargate pools: defaults from Stargate V2 mainnet docs; override with
 * STARGATE_BASE_POOLS / STARGATE_ETH_POOLS (comma-separated).
 */

export const ACROSS_SPOKE_BASE =
  "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64" as const;
export const ACROSS_SPOKE_ETH =
  "0x5c7BCd6E7De5423a257D81B442095A1a6ced3355" as const;

/** Hop ETH L1 Bridge (ethereum → L2s including Base). */
export const HOP_ETH_L1_BRIDGE =
  "0xb8901acB165ed027E32754E0FFe830802919727f" as const;
/** Hop ETH L2 Bridge on Base. */
export const HOP_ETH_BASE_L2_BRIDGE =
  "0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a" as const;
/** Hop USDC.e (bridged USDC) L1 Bridge. */
export const HOP_USDCE_L1_BRIDGE =
  "0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a" as const;
/** Hop USDC.e L2 Bridge on Base. */
export const HOP_USDCE_BASE_L2_BRIDGE =
  "0x46ae9BaB8CEA96610807a275EBD36f8e916b5C61" as const;

/** Stargate V2 docs — Base native ETH + USDC pools. */
export const DEFAULT_STARGATE_BASE_POOLS = [
  "0xdc181Bd607330aeeBEF6ea62e03e5e1Fb4B6F7C7", // PoolNative
  "0x27a16dc786820B16E5c9028b75B99F6f604b5d26", // PoolUSDC
] as const;

/** Stargate V2 docs — Ethereum native ETH + USDC pools. */
export const DEFAULT_STARGATE_ETH_POOLS = [
  "0x77b2043768d28E9C9aB44E1aBfC95944bcE57931", // PoolNative
  "0xc026395860Db2d07ee33e05fE50ed7bD583189C7", // PoolUSDC
] as const;

export const AcrossSpokePoolAbi = [
  {
    type: "event",
    name: "V3FundsDeposited",
    inputs: [
      { name: "inputToken", type: "address", indexed: false },
      { name: "outputToken", type: "address", indexed: false },
      { name: "inputAmount", type: "uint256", indexed: false },
      { name: "outputAmount", type: "uint256", indexed: false },
      { name: "destinationChainId", type: "uint256", indexed: true },
      { name: "depositId", type: "uint32", indexed: true },
      { name: "quoteTimestamp", type: "uint32", indexed: false },
      { name: "fillDeadline", type: "uint32", indexed: false },
      { name: "exclusivityDeadline", type: "uint32", indexed: false },
      { name: "depositor", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: false },
      { name: "exclusiveRelayer", type: "address", indexed: false },
      { name: "message", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FilledV3Relay",
    inputs: [
      { name: "inputToken", type: "address", indexed: false },
      { name: "outputToken", type: "address", indexed: false },
      { name: "inputAmount", type: "uint256", indexed: false },
      { name: "outputAmount", type: "uint256", indexed: false },
      { name: "repaymentChainId", type: "uint256", indexed: false },
      { name: "originChainId", type: "uint256", indexed: true },
      { name: "depositId", type: "uint32", indexed: true },
      { name: "fillDeadline", type: "uint32", indexed: false },
      { name: "exclusivityDeadline", type: "uint32", indexed: false },
      { name: "exclusiveRelayer", type: "address", indexed: false },
      { name: "relayer", type: "address", indexed: true },
      { name: "depositor", type: "address", indexed: false },
      { name: "recipient", type: "address", indexed: false },
      { name: "message", type: "bytes", indexed: false },
      {
        name: "relayExecutionInfo",
        type: "tuple",
        indexed: false,
        components: [
          { name: "updatedRecipient", type: "address" },
          { name: "updatedMessage", type: "bytes" },
          { name: "updatedOutputAmount", type: "uint256" },
          { name: "fillType", type: "uint8" },
        ],
      },
    ],
  },
] as const;

/** Classic Hop L2 TransferSent (topic 0xe35dddd4…). */
export const HopL2BridgeAbi = [
  {
    type: "event",
    name: "TransferSent",
    inputs: [
      { name: "transferId", type: "bytes32", indexed: true },
      { name: "chainId", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "transferNonce", type: "bytes32", indexed: false },
      { name: "bonderFee", type: "uint256", indexed: false },
      { name: "index", type: "uint256", indexed: false },
      { name: "amountOutMin", type: "uint256", indexed: false },
      { name: "deadline", type: "uint256", indexed: false },
    ],
  },
] as const;

/** Hop L1 TransferSentToL2 (topic 0x0a060768…). */
export const HopL1BridgeAbi = [
  {
    type: "event",
    name: "TransferSentToL2",
    inputs: [
      { name: "chainId", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "amountOutMin", type: "uint256", indexed: false },
      { name: "deadline", type: "uint256", indexed: false },
      { name: "relayer", type: "address", indexed: true },
      { name: "relayerFee", type: "uint256", indexed: false },
    ],
  },
] as const;

export const OftBridgeAbi = [
  {
    type: "event",
    name: "OFTSent",
    inputs: [
      { name: "guid", type: "bytes32", indexed: true },
      { name: "dstEid", type: "uint32", indexed: false },
      { name: "fromAddress", type: "address", indexed: true },
      { name: "amountSentLD", type: "uint256", indexed: false },
      { name: "amountReceivedLD", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OFTReceived",
    inputs: [
      { name: "guid", type: "bytes32", indexed: true },
      { name: "srcEid", type: "uint32", indexed: false },
      { name: "toAddress", type: "address", indexed: true },
      { name: "amountReceivedLD", type: "uint256", indexed: false },
    ],
  },
] as const;

export const LZ_EID_ETH = 30101;
export const LZ_EID_BASE = 30184;

export function indexThirdPartyBridges(): boolean {
  const v = (process.env.INDEX_THIRD_PARTY_BRIDGES || "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

export function indexHopBridges(): boolean {
  const v = (process.env.INDEX_HOP_BRIDGES || "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

export function thirdPartyBridgeStartBlock(fallback: number): number {
  const v = process.env.THIRD_PARTY_BRIDGE_START_BLOCK?.trim();
  return v ? parseInt(v, 10) : fallback;
}

function parsePoolEnv(raw: string | undefined, defaults: readonly string[]): `0x${string}`[] {
  const src = (raw || "").trim() ? raw! : defaults.join(",");
  const out: `0x${string}`[] = [];
  const seen = new Set<string>();
  for (const part of src.split(",")) {
    const s = part.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(s)) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s as `0x${string}`);
  }
  return out;
}

/** Stargate/OFT pool addresses on Base. Empty env → V2 doc defaults. Set STARGATE_BASE_POOLS=0 to disable. */
export function stargateBasePools(): `0x${string}`[] {
  const raw = process.env.STARGATE_BASE_POOLS;
  if (raw?.trim() === "0" || raw?.trim().toLowerCase() === "off") return [];
  return parsePoolEnv(raw, DEFAULT_STARGATE_BASE_POOLS);
}

/** Stargate/OFT pool addresses on Ethereum. Empty env → V2 doc defaults. Set STARGATE_ETH_POOLS=0 to disable. */
export function stargateEthPools(): `0x${string}`[] {
  const raw = process.env.STARGATE_ETH_POOLS;
  if (raw?.trim() === "0" || raw?.trim().toLowerCase() === "off") return [];
  return parsePoolEnv(raw, DEFAULT_STARGATE_ETH_POOLS);
}
