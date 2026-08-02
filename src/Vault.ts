import { ponder, type Context } from "ponder:registry";
import schema from "ponder:schema";

type DepositEvent = {
  args: {
    depositor: `0x${string}`;
    amount: bigint;
    commitment: bigint;
    precommitment: bigint;
    label: bigint;
    nonce: bigint;
  };
  log: { address: `0x${string}`; logIndex: number };
  block: { number: bigint; timestamp: bigint };
  transaction: { hash: `0x${string}` };
};

async function insertDeposit(
  event: DepositEvent,
  context: Context,
  chainId: number,
  asset: string,
) {
  const { depositor, amount, commitment, precommitment, label, nonce } = event.args;
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
    label: label.toString(),
    nonce: nonce.toString(),
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
