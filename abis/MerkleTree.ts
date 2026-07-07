export const MerkleTreeAbi = [
  {
    type: "event",
    name: "LeafInserted",
    inputs: [
      { name: "_index", type: "uint256", indexed: false },
      { name: "_leaf", type: "uint256", indexed: false },
      { name: "_root", type: "uint256", indexed: false },
    ],
  },
] as const;
