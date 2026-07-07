import { ponder } from "ponder:registry";
import schema from "ponder:schema";

async function insertDeposit(
  event: {
    args: {
      depositor: `0x${string}`;
      amount: bigint;
      commitment: bigint;
      precommitment: bigint;
    };
    log: { address: `0x${string}`; logIndex: number };
    block: { number: bigint; timestamp: bigint };
    transaction: { hash: `0x${string}` };
  },
  context: { db: { insert: (table: typeof schema.vaultDeposit) => { values: (v: unknown) => Promise<void> } } },
  chainId: number,
  asset: string,
) {
  const { depositor, amount, commitment, precommitment } = event.args;
  const id = `${event.transaction.hash}-${event.log.logIndex}`;

  await context.db.insert(schema.vaultDeposit).values({
    id,
    chainId,
    asset,
    vault: event.log.address,
    depositor,
    amount: amount.toString(),
    commitment: commitment.toString(),
    precommitment: precommitment.toString(),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });
}

ponder.on("VaultBaseEth:Deposited", async ({ event, context }) => {
  await insertDeposit(event, context, 8453, "ETH");
});

ponder.on("VaultBaseUsdc:Deposited", async ({ event, context }) => {
  await insertDeposit(event, context, 8453, "USDC");
});

ponder.on("VaultSepoliaEth:Deposited", async ({ event, context }) => {
  await insertDeposit(event, context, 11155111, "ETH");
});

ponder.on("VaultSepoliaUsdc:Deposited", async ({ event, context }) => {
  await insertDeposit(event, context, 11155111, "USDC");
});
