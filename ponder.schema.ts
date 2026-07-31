import { index, onchainTable } from "ponder";

export const merkleLeaf = onchainTable(
  "merkle_leaf",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    asset: t.text().notNull(),
    merkleTree: t.hex().notNull(),
    leafIndex: t.bigint().notNull(),
    leaf: t.text().notNull(),
    root: t.text().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    chainAssetIdx: index().on(table.chainId, table.asset),
    leafIdx: index().on(table.leaf),
    treeIdx: index().on(table.merkleTree),
  }),
);

export const vaultDeposit = onchainTable(
  "vault_deposit",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    asset: t.text().notNull(),
    vault: t.hex().notNull(),
    depositor: t.hex().notNull(),
    amount: t.text().notNull(),
    commitment: t.text().notNull(),
    precommitment: t.text().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    chainPrecommitmentIdx: index().on(table.chainId, table.precommitment),
    commitmentIdx: index().on(table.commitment),
    chainAssetIdx: index().on(table.chainId, table.asset),
  }),
);

/**
 * Privacy-mixer association touches (Base Veil + ETH Tornado).
 * direction: from_pool = exit recipient; to_pool = depositor into mixer/entry.
 */
export const tornadoTouch = onchainTable(
  "tornado_touch",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    pool: t.hex().notNull(),
    poolLabel: t.text().notNull(),
    counterparty: t.hex().notNull(),
    direction: t.text().notNull(), // from_pool | to_pool
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    counterpartyIdx: index().on(table.chainId, table.counterparty),
    directionTimeIdx: index().on(table.chainId, table.direction, table.blockTimestamp),
    poolIdx: index().on(table.pool),
  }),
);

/**
 * Cross-chain bridge edges (Base↔ETH).
 * bridge labels: base_standard | across | stargate | hop
 */
export const bridgeEdge = onchainTable(
  "bridge_edge",
  (t) => ({
    id: t.text().primaryKey(),
    bridge: t.text().notNull(),
    direction: t.text().notNull(), // eth_to_base | base_to_eth
    srcChainId: t.integer().notNull(),
    dstChainId: t.integer().notNull(),
    srcAddress: t.hex().notNull(),
    dstAddress: t.hex().notNull(),
    token: t.text().notNull(), // eth | erc20:0x… | oft | hop
    amount: t.text().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    dstAddrIdx: index().on(table.dstChainId, table.dstAddress),
    srcAddrIdx: index().on(table.srcChainId, table.srcAddress),
    timeIdx: index().on(table.blockTimestamp),
  }),
);

/**
 * Stargate/LayerZero OFT guid join — OFTSent and OFTReceived land on different
 * chains; we only emit bridge_edge once both sides are known.
 */
export const stargateGuid = onchainTable(
  "stargate_guid",
  (t) => ({
    id: t.hex().primaryKey(), // LayerZero guid
    srcChainId: t.integer().notNull(),
    dstChainId: t.integer().notNull(),
    srcAddress: t.hex().notNull(), // ZERO until OFTSent seen
    dstAddress: t.hex().notNull(), // ZERO until OFTReceived seen
    amount: t.text().notNull(),
    srcTxHash: t.hex().notNull(),
    dstTxHash: t.hex().notNull(),
    srcBlockNumber: t.bigint().notNull(),
    srcBlockTimestamp: t.bigint().notNull(),
    dstBlockNumber: t.bigint().notNull(),
    dstBlockTimestamp: t.bigint().notNull(),
    complete: t.boolean().notNull(),
  }),
  (table) => ({
    completeIdx: index().on(table.complete),
  }),
);
