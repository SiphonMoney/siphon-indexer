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

export const vaultSwap = onchainTable(
  "vault_swap",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    asset: t.text().notNull(),
    vault: t.hex().notNull(),
    recipient: t.hex().notNull(),
    pool: t.hex().notNull(),
    srcToken: t.hex().notNull(),
    dstToken: t.hex().notNull(),
    amountIn: t.text().notNull(),
    minAmountOut: t.text().notNull(),
    fee: t.text().notNull(),
    spentNullifier: t.text().notNull(),
    newCommitment: t.text().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    chainAssetIdx: index().on(table.chainId, table.asset),
    chainTimeIdx: index().on(table.chainId, table.blockTimestamp),
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

/** Cross-chain bridge edges (Base↔ETH). */
export const bridgeEdge = onchainTable(
  "bridge_edge",
  (t) => ({
    id: t.text().primaryKey(),
    bridge: t.text().notNull(),
    direction: t.text().notNull(),
    srcChainId: t.integer().notNull(),
    dstChainId: t.integer().notNull(),
    srcAddress: t.hex().notNull(),
    dstAddress: t.hex().notNull(),
    token: t.text().notNull(),
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

/** LayerZero OFT guid join; a bridge edge is emitted after both sides are known. */
export const stargateGuid = onchainTable(
  "stargate_guid",
  (t) => ({
    id: t.hex().primaryKey(),
    srcChainId: t.integer().notNull(),
    dstChainId: t.integer().notNull(),
    srcAddress: t.hex().notNull(),
    dstAddress: t.hex().notNull(),
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
