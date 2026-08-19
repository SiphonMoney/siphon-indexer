import { ponder, type Context } from "ponder:registry";
import { decodeFunctionData, type Hex } from "viem";
import { VeilNovaPoolAbi } from "../abis/VeilMixer";
import { BASE_MIXER_POOLS, indexBaseMixers } from "./mixerPools.base";
import { includesBase, parseIndexerScope } from "./indexerScope";
import { insertTornadoTouch } from "./touchInsert";

const CHAIN_ID = 8453;

// Old compliance pipeline depended on "mixer touches" rows. We keep the indexer,
// but can disable mixer-touch indexing/serving to save cost.
const indexMixerTouches =
  !["0", "false", "no"].includes((process.env.INDEX_MIXER_TOUCHES ?? "1").trim().toLowerCase());

/** Dedup RPC decode during multi-nullifier withdraw txs. */
const recipientCache = new Map<string, string | null>();

const labelByAddress = new Map(
  BASE_MIXER_POOLS.map((p) => [p.address.toLowerCase(), p.label] as const),
);

function labelFor(pool: string): string {
  return labelByAddress.get(pool.toLowerCase()) || "unknown";
}

/** Decode Nova withdraw/transact calldata → public exit recipient (from_pool). */
async function recipientFromNovaTx(
  context: Context,
  txHash: `0x${string}`,
): Promise<string | null> {
  if (recipientCache.has(txHash)) {
    return recipientCache.get(txHash) ?? null;
  }
  try {
    const tx = await context.client.getTransaction({ hash: txHash });
    if (!tx?.input || tx.input === "0x") {
      recipientCache.set(txHash, null);
      return null;
    }
    const decoded = decodeFunctionData({
      abi: VeilNovaPoolAbi,
      data: tx.input as Hex,
    });
    if (
      decoded.functionName !== "withdrawETH" &&
      decoded.functionName !== "transactETH" &&
      decoded.functionName !== "withdrawUSDC" &&
      decoded.functionName !== "transactUSDC"
    ) {
      recipientCache.set(txHash, null);
      return null;
    }
    const extData = decoded.args[1] as { recipient: string; extAmount: bigint };
    if (extData.extAmount >= 0n && !decoded.functionName.startsWith("withdraw")) {
      recipientCache.set(txHash, null);
      return null;
    }
    recipientCache.set(txHash, extData.recipient);
    return extData.recipient;
  } catch {
    recipientCache.set(txHash, null);
    return null;
  }
}

const registerBaseMixerHandlers =
  indexMixerTouches && includesBase(parseIndexerScope(process.env.INDEXER_SCOPE)) && indexBaseMixers();

if (registerBaseMixerHandlers) {
ponder.on("VeilEntry:DepositedETH", async ({ event, context }) => {
  await insertTornadoTouch(context, {
    chainId: CHAIN_ID,
    pool: event.log.address,
    poolLabel: labelFor(event.log.address),
    counterparty: event.args.depositor,
    direction: "to_pool",
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    txHash: event.transaction.hash,
    logOrCallId: `${event.log.logIndex}-eth`,
  });
});

ponder.on("VeilEntry:DepositedUSDC", async ({ event, context }) => {
  await insertTornadoTouch(context, {
    chainId: CHAIN_ID,
    pool: event.log.address,
    poolLabel: labelFor(event.log.address),
    counterparty: event.args.depositor,
    direction: "to_pool",
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    txHash: event.transaction.hash,
    logOrCallId: `${event.log.logIndex}-usdc`,
  });
});

async function onNovaNullifier(
  event: {
    log: { address: `0x${string}`; logIndex: number };
    block: { number: bigint; timestamp: bigint };
    transaction: { hash: `0x${string}` };
  },
  context: Context,
) {
  const recipient = await recipientFromNovaTx(context, event.transaction.hash);
  if (!recipient) return;
  await insertTornadoTouch(context, {
    chainId: CHAIN_ID,
    pool: event.log.address,
    poolLabel: labelFor(event.log.address),
    counterparty: recipient,
    direction: "from_pool",
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    txHash: event.transaction.hash,
    logOrCallId: `${event.log.logIndex}-nullifier`,
  });
}

ponder.on("VeilEthPool:NewNullifier", async ({ event, context }) => {
  await onNovaNullifier(event, context);
});

ponder.on("VeilUsdcPool:NewNullifier", async ({ event, context }) => {
  await onNovaNullifier(event, context);
});

ponder.on("VeilLegacy01Eth:Withdrawal", async ({ event, context }) => {
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
});

ponder.on("VeilLegacy01Eth:Deposit", async ({ event, context }) => {
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
});
}
