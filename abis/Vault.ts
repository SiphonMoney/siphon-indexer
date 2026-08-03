export const VaultAbi = [
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "depositor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "commitment", type: "uint256", indexed: false },
      { name: "precommitment", type: "uint256", indexed: false },
      { name: "label", type: "uint256", indexed: false },
      { name: "nonce", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LabelMinted",
    inputs: [
      { name: "label", type: "uint256", indexed: true },
      { name: "commitment", type: "uint256", indexed: false },
      { name: "depositor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ChangeLabeled",
    inputs: [
      { name: "label", type: "uint256", indexed: true },
      { name: "commitment", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Swapped",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      {
        name: "_param",
        type: "tuple",
        indexed: false,
        components: [
          { name: "pool", type: "address" },
          { name: "srcToken", type: "address" },
          { name: "dstToken", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "minAmountOut", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "_spentNullifier", type: "uint256", indexed: false },
      { name: "_newCommitment", type: "uint256", indexed: false },
      { name: "_newLabel", type: "uint256", indexed: false },
    ],
  },
] as const;
