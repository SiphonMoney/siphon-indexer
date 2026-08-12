import { ponder, type Context } from "ponder:registry";
import { insertTornadoTouch } from "./touchInsert";
import { ETH_TORNADO_POOLS, indexEthTornado } from "./mixerPools.eth";
import { parseIndexerScope } from "./indexerScope";

const CHAIN_ID = 1;

const labelByAddress = new Map(
  ETH_TORNADO_POOLS.map((p) => [p.address.toLowerCase(), p.label] as const),
);

function labelFor(pool: string): string {
  return labelByAddress.get(pool.toLowerCase()) || "tornado_classic";
}

async function onWithdrawal(
  event: {
    args: { to: string };
    log: { address: `0x${string}`; logIndex: number };
    block: { number: bigint; timestamp: bigint };
    transaction: { hash: `0x${string}` };
  },
  context: Context,
) {
  await insertTornadoTouch(context, {
    chainId: CHAIN_ID,
    pool: event.log.address,
    poolLabel: labelFor(event.log.address),
    counterparty: event.args.to,
    direction: "from_pool",
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    txHash: event.transaction.hash,
    logOrCallId: `${event.log.logIndex}-wd`,
  });
}

async function onDeposit(
  event: {
    log: { address: `0x${string}`; logIndex: number };
    block: { number: bigint; timestamp: bigint };
    transaction: { hash: `0x${string}`; from?: `0x${string}` };
  },
  context: Context,
) {
  const from = event.transaction.from;
  if (!from) return;
  await insertTornadoTouch(context, {
    chainId: CHAIN_ID,
    pool: event.log.address,
    poolLabel: labelFor(event.log.address),
    counterparty: from,
    direction: "to_pool",
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    txHash: event.transaction.hash,
    logOrCallId: `${event.log.logIndex}-dep`,
  });
}

if (parseIndexerScope(process.env.INDEXER_SCOPE) === "all" && indexEthTornado()) {
  ponder.on("TornadoEth01:Withdrawal", async ({ event, context }) => {
    await onWithdrawal(event, context);
  });
  ponder.on("TornadoEth01:Deposit", async ({ event, context }) => {
    await onDeposit(event, context);
  });
  ponder.on("TornadoEth1:Withdrawal", async ({ event, context }) => {
    await onWithdrawal(event, context);
  });
  ponder.on("TornadoEth1:Deposit", async ({ event, context }) => {
    await onDeposit(event, context);
  });
  ponder.on("TornadoEth10:Withdrawal", async ({ event, context }) => {
    await onWithdrawal(event, context);
  });
  ponder.on("TornadoEth10:Deposit", async ({ event, context }) => {
    await onDeposit(event, context);
  });
  ponder.on("TornadoEth100:Withdrawal", async ({ event, context }) => {
    await onWithdrawal(event, context);
  });
  ponder.on("TornadoEth100:Deposit", async ({ event, context }) => {
    await onDeposit(event, context);
  });
}
