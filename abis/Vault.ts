export const VaultAbi = [
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "depositor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "commitment", type: "uint256", indexed: false },
      { name: "precommitment", type: "uint256", indexed: false },
    ],
  },
] as const;
