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
] as const;
