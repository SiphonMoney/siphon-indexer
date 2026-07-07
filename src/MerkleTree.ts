import { ponder } from "ponder:registry";
import schema from "ponder:schema";

async function insertLeaf(
  event: {
    args: { _index: bigint; _leaf: bigint; _root: bigint };
    log: { address: `0x${string}` };
    block: { number: bigint; timestamp: bigint };
    transaction: { hash: `0x${string}` };
  },
  context: { db: { insert: (table: typeof schema.merkleLeaf) => { values: (v: unknown) => Promise<void> } } },
  chainId: number,
  asset: string,
) {
  const { _index, _leaf, _root } = event.args;
  const id = `${chainId}-${event.log.address.toLowerCase()}-${_index.toString()}`;

  await context.db.insert(schema.merkleLeaf).values({
    id,
    chainId,
    asset,
    merkleTree: event.log.address,
    leafIndex: _index,
    leaf: _leaf.toString(),
    root: _root.toString(),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });
}

ponder.on("MerkleTreeBaseEth:LeafInserted", async ({ event, context }) => {
  await insertLeaf(event, context, 8453, "ETH");
});

ponder.on("MerkleTreeBaseUsdc:LeafInserted", async ({ event, context }) => {
  await insertLeaf(event, context, 8453, "USDC");
});

ponder.on("MerkleTreeSepoliaEth:LeafInserted", async ({ event, context }) => {
  await insertLeaf(event, context, 11155111, "ETH");
});

ponder.on("MerkleTreeSepoliaUsdc:LeafInserted", async ({ event, context }) => {
  await insertLeaf(event, context, 11155111, "USDC");
});
