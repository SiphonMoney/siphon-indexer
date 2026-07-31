/**
 * Veil Cash / Tornado-Nova style pool — events + withdraw/transact fns for calldata decode.
 * Live Base ETH/USDC pools emit NewCommitment/NewNullifier only; recipient lives in extData.
 */
export const VeilNovaPoolAbi = [
  {
    type: "event",
    name: "NewCommitment",
    inputs: [
      { name: "commitment", type: "bytes32", indexed: false },
      { name: "index", type: "uint256", indexed: false },
      { name: "encryptedOutput", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "NewNullifier",
    inputs: [{ name: "nullifier", type: "bytes32", indexed: false }],
  },
  {
    type: "function",
    name: "withdrawETH",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "_args",
        type: "tuple",
        components: [
          { name: "proof", type: "bytes" },
          { name: "root", type: "bytes32" },
          { name: "inputNullifiers", type: "bytes32[]" },
          { name: "outputCommitments", type: "bytes32[2]" },
          { name: "publicAmount", type: "uint256" },
          { name: "extDataHash", type: "bytes32" },
        ],
      },
      {
        name: "_extData",
        type: "tuple",
        components: [
          { name: "recipient", type: "address" },
          { name: "extAmount", type: "int256" },
          { name: "relayer", type: "address" },
          { name: "fee", type: "uint256" },
          { name: "encryptedOutput1", type: "bytes" },
          { name: "encryptedOutput2", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "transactETH",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "_args",
        type: "tuple",
        components: [
          { name: "proof", type: "bytes" },
          { name: "root", type: "bytes32" },
          { name: "inputNullifiers", type: "bytes32[]" },
          { name: "outputCommitments", type: "bytes32[2]" },
          { name: "publicAmount", type: "uint256" },
          { name: "extDataHash", type: "bytes32" },
        ],
      },
      {
        name: "_extData",
        type: "tuple",
        components: [
          { name: "recipient", type: "address" },
          { name: "extAmount", type: "int256" },
          { name: "relayer", type: "address" },
          { name: "fee", type: "uint256" },
          { name: "encryptedOutput1", type: "bytes" },
          { name: "encryptedOutput2", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
  // USDC pool mirrors with withdrawUSDC / transactUSDC (same extData shape)
  {
    type: "function",
    name: "withdrawUSDC",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "_args",
        type: "tuple",
        components: [
          { name: "proof", type: "bytes" },
          { name: "root", type: "bytes32" },
          { name: "inputNullifiers", type: "bytes32[]" },
          { name: "outputCommitments", type: "bytes32[2]" },
          { name: "publicAmount", type: "uint256" },
          { name: "extDataHash", type: "bytes32" },
        ],
      },
      {
        name: "_extData",
        type: "tuple",
        components: [
          { name: "recipient", type: "address" },
          { name: "extAmount", type: "int256" },
          { name: "relayer", type: "address" },
          { name: "fee", type: "uint256" },
          { name: "encryptedOutput1", type: "bytes" },
          { name: "encryptedOutput2", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "transactUSDC",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "_args",
        type: "tuple",
        components: [
          { name: "proof", type: "bytes" },
          { name: "root", type: "bytes32" },
          { name: "inputNullifiers", type: "bytes32[]" },
          { name: "outputCommitments", type: "bytes32[2]" },
          { name: "publicAmount", type: "uint256" },
          { name: "extDataHash", type: "bytes32" },
        ],
      },
      {
        name: "_extData",
        type: "tuple",
        components: [
          { name: "recipient", type: "address" },
          { name: "extAmount", type: "int256" },
          { name: "relayer", type: "address" },
          { name: "fee", type: "uint256" },
          { name: "encryptedOutput1", type: "bytes" },
          { name: "encryptedOutput2", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

/** Veil Entry — public depositors into the queue/pool path. */
export const VeilEntryAbi = [
  {
    type: "event",
    name: "DepositedETH",
    inputs: [
      { name: "depositor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DepositedUSDC",
    inputs: [
      { name: "depositor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

/**
 * Classic Tornado-style (Veil legacy 0.1 ETH pool): Withdrawal includes recipient + timestamp.
 * event Withdrawal(address to, bytes32 nullifierHash, address relayer, uint256 fee, uint256 timestamp)
 */
export const VeilClassicPoolAbi = [
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
      { name: "relayer", type: "address", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;
