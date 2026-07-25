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
