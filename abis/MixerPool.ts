/**
 * Classic Tornado Cash Deposit/Withdrawal (4-arg Withdrawal) — reserved for optional
 * Ethereum mainnet association indexing later. Base live path uses VeilMixer.ts.
 */
export const MixerPoolAbi = [
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
