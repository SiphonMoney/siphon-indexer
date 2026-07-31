/**
 * Classic Tornado Cash pool events (Ethereum mainnet).
 * Withdrawal(address to, bytes32 nullifierHash, address indexed relayer, uint256 fee)
 */
export const TornadoClassicPoolAbi = [
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "commitment", type: "bytes32", indexed: true },
      { name: "leafIndex", type: "uint32", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdrawal",
    inputs: [
      { name: "to", type: "address", indexed: false },
      { name: "nullifierHash", type: "bytes32", indexed: false },
      { name: "relayer", type: "address", indexed: true },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
] as const;

/**
 * Optimism/Base StandardBridge events used for ETH↔Base association edges.
 * @see https://docs.base.org/base-chain/specs/protocol/bridging/bridges
 */
export const StandardBridgeAbi = [
  {
    type: "event",
    name: "ETHBridgeFinalized",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "extraData", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ETHBridgeInitiated",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "extraData", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ERC20BridgeFinalized",
    inputs: [
      { name: "localToken", type: "address", indexed: true },
      { name: "remoteToken", type: "address", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "extraData", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ERC20BridgeInitiated",
    inputs: [
      { name: "localToken", type: "address", indexed: true },
      { name: "remoteToken", type: "address", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "extraData", type: "bytes", indexed: false },
    ],
  },
] as const;

/** Base L2 predeploy StandardBridge */
export const BASE_L2_STANDARD_BRIDGE =
  "0x4200000000000000000000000000000000000010" as const;

/** Ethereum L1 Base StandardBridge proxy */
export const ETH_L1_STANDARD_BRIDGE =
  "0x3154Cf16ccdb4C6d922629664174b904d80F2C35" as const;

export function indexBaseBridges(): boolean {
  const v = (process.env.INDEX_BASE_BRIDGES || "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

export function bridgeStartBlock(fallback: number): number {
  const v = process.env.BASE_BRIDGE_START_BLOCK?.trim();
  return v ? parseInt(v, 10) : fallback;
}
