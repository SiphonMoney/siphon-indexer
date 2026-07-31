import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import {
  LZ_EID_BASE,
  LZ_EID_ETH,
  indexHopBridges,
  indexThirdPartyBridges,
  stargateBasePools,
  stargateEthPools,
} from "../abis/ThirdPartyBridges";

const ZERO = "0x0000000000000000000000000000000000000000";
const BASE = 8453;
const ETH = 1;

type DbCtx = {
  db: {
    insert: (table: unknown) => {
      values: (v: Record<string, unknown>) => Promise<unknown>;
    };
    find: (
      table: typeof schema.stargateGuid,
      pk: { id: `0x${string}` },
    ) => Promise<Record<string, unknown> | null | undefined>;
    update: (
      table: typeof schema.stargateGuid,
      pk: { id: `0x${string}` },
    ) => {
      set: (v: Record<string, unknown>) => Promise<unknown>;
    };
  };
};

async function insertEdge(
  context: DbCtx,
  args: {
    bridge: string;
    direction: "eth_to_base" | "base_to_eth";
    srcChainId: number;
    dstChainId: number;
    srcAddress: string;
    dstAddress: string;
    token: string;
    amount: bigint | string;
    blockNumber: bigint;
    blockTimestamp: bigint;
    txHash: `0x${string}`;
    logIndex: number;
    id?: string;
  },
) {
  const src = args.srcAddress.toLowerCase() as `0x${string}`;
  const dst = args.dstAddress.toLowerCase() as `0x${string}`;
  if (src === ZERO || dst === ZERO) return;

  const id =
    args.id ?? `${args.bridge}-${args.direction}-${args.txHash}-${args.logIndex}`;
  await context.db.insert(schema.bridgeEdge).values({
    id,
    bridge: args.bridge,
    direction: args.direction,
    srcChainId: args.srcChainId,
    dstChainId: args.dstChainId,
    srcAddress: src,
    dstAddress: dst,
    token: args.token,
    amount: args.amount.toString(),
    blockNumber: args.blockNumber,
    blockTimestamp: args.blockTimestamp,
    txHash: args.txHash,
  });
}

function eidToChain(eid: number): number | null {
  if (eid === LZ_EID_ETH) return ETH;
  if (eid === LZ_EID_BASE) return BASE;
  return null;
}

function asAddr(v: unknown): `0x${string}` | null {
  if (typeof v !== "string" || !v.startsWith("0x")) return null;
  const a = v.toLowerCase() as `0x${string}`;
  return a === ZERO ? null : a;
}

async function maybeEmitStargateEdge(
  context: DbCtx,
  row: {
    id: `0x${string}`;
    srcChainId: number | null;
    dstChainId: number | null;
    srcAddress: `0x${string}` | null;
    dstAddress: `0x${string}` | null;
    amount: string | null;
    srcTxHash: `0x${string}` | null;
    dstTxHash: `0x${string}` | null;
    srcBlockNumber: bigint | null;
    srcBlockTimestamp: bigint | null;
    dstBlockNumber: bigint | null;
    dstBlockTimestamp: bigint | null;
  },
) {
  if (!row.srcAddress || !row.dstAddress || row.srcChainId == null || row.dstChainId == null) {
    return;
  }
  const direction =
    row.srcChainId === ETH && row.dstChainId === BASE
      ? "eth_to_base"
      : row.srcChainId === BASE && row.dstChainId === ETH
        ? "base_to_eth"
        : null;
  if (!direction) return;

  await insertEdge(context, {
    id: `stargate-guid-${row.id}`,
    bridge: "stargate",
    direction,
    srcChainId: row.srcChainId,
    dstChainId: row.dstChainId,
    srcAddress: row.srcAddress,
    dstAddress: row.dstAddress,
    token: "oft",
    amount: row.amount ?? "0",
    blockNumber: row.dstBlockNumber ?? row.srcBlockNumber ?? 0n,
    blockTimestamp: row.dstBlockTimestamp ?? row.srcBlockTimestamp ?? 0n,
    txHash: (row.dstTxHash ?? row.srcTxHash ?? ZERO) as `0x${string}`,
    logIndex: 0,
  });
  await context.db.update(schema.stargateGuid, { id: row.id }).set({ complete: true });
}

async function onOftSent(
  context: DbCtx,
  args: {
    guid: `0x${string}`;
    dstEid: number;
    fromAddress: string;
    amount: bigint;
    srcChainId: number;
    txHash: `0x${string}`;
    blockNumber: bigint;
    blockTimestamp: bigint;
  },
) {
  const dstChainId = eidToChain(args.dstEid);
  if (dstChainId == null) return;
  if (
    !(
      (args.srcChainId === ETH && dstChainId === BASE) ||
      (args.srcChainId === BASE && dstChainId === ETH)
    )
  ) {
    return;
  }

  const guid = args.guid.toLowerCase() as `0x${string}`;
  const srcAddress = args.fromAddress.toLowerCase() as `0x${string}`;
  const existing = await context.db.find(schema.stargateGuid, { id: guid });

  if (!existing) {
    await context.db.insert(schema.stargateGuid).values({
      id: guid,
      srcChainId: args.srcChainId,
      dstChainId,
      srcAddress,
      dstAddress: ZERO,
      amount: args.amount.toString(),
      srcTxHash: args.txHash,
      dstTxHash: ZERO,
      srcBlockNumber: args.blockNumber,
      srcBlockTimestamp: args.blockTimestamp,
      dstBlockNumber: 0n,
      dstBlockTimestamp: 0n,
      complete: false,
    });
    return;
  }

  const dstAddress = asAddr(existing.dstAddress);
  await context.db.update(schema.stargateGuid, { id: guid }).set({
    srcChainId: args.srcChainId,
    dstChainId,
    srcAddress,
    amount: args.amount.toString(),
    srcTxHash: args.txHash,
    srcBlockNumber: args.blockNumber,
    srcBlockTimestamp: args.blockTimestamp,
  });

  if (dstAddress && !existing.complete) {
    await maybeEmitStargateEdge(context, {
      id: guid,
      srcChainId: args.srcChainId,
      dstChainId,
      srcAddress,
      dstAddress,
      amount: args.amount.toString(),
      srcTxHash: args.txHash,
      dstTxHash: asAddr(existing.dstTxHash),
      srcBlockNumber: args.blockNumber,
      srcBlockTimestamp: args.blockTimestamp,
      dstBlockNumber: (existing.dstBlockNumber as bigint) || null,
      dstBlockTimestamp: (existing.dstBlockTimestamp as bigint) || null,
    });
  }
}

async function onOftReceived(
  context: DbCtx,
  args: {
    guid: `0x${string}`;
    srcEid: number;
    toAddress: string;
    amount: bigint;
    dstChainId: number;
    txHash: `0x${string}`;
    blockNumber: bigint;
    blockTimestamp: bigint;
  },
) {
  const srcChainId = eidToChain(args.srcEid);
  if (srcChainId == null) return;
  if (
    !(
      (srcChainId === ETH && args.dstChainId === BASE) ||
      (srcChainId === BASE && args.dstChainId === ETH)
    )
  ) {
    return;
  }

  const guid = args.guid.toLowerCase() as `0x${string}`;
  const dstAddress = args.toAddress.toLowerCase() as `0x${string}`;
  const existing = await context.db.find(schema.stargateGuid, { id: guid });

  if (!existing) {
    await context.db.insert(schema.stargateGuid).values({
      id: guid,
      srcChainId,
      dstChainId: args.dstChainId,
      srcAddress: ZERO,
      dstAddress,
      amount: args.amount.toString(),
      srcTxHash: ZERO,
      dstTxHash: args.txHash,
      srcBlockNumber: 0n,
      srcBlockTimestamp: 0n,
      dstBlockNumber: args.blockNumber,
      dstBlockTimestamp: args.blockTimestamp,
      complete: false,
    });
    return;
  }

  const srcAddress = asAddr(existing.srcAddress);
  await context.db.update(schema.stargateGuid, { id: guid }).set({
    srcChainId,
    dstChainId: args.dstChainId,
    dstAddress,
    amount: args.amount.toString(),
    dstTxHash: args.txHash,
    dstBlockNumber: args.blockNumber,
    dstBlockTimestamp: args.blockTimestamp,
  });

  if (srcAddress && !existing.complete) {
    await maybeEmitStargateEdge(context, {
      id: guid,
      srcChainId,
      dstChainId: args.dstChainId,
      srcAddress,
      dstAddress,
      amount: args.amount.toString(),
      srcTxHash: asAddr(existing.srcTxHash),
      dstTxHash: args.txHash,
      srcBlockNumber: (existing.srcBlockNumber as bigint) || null,
      srcBlockTimestamp: (existing.srcBlockTimestamp as bigint) || null,
      dstBlockNumber: args.blockNumber,
      dstBlockTimestamp: args.blockTimestamp,
    });
  }
}

// --- Across ---
if (indexThirdPartyBridges()) {
  ponder.on("AcrossSpokeBase:FilledV3Relay", async ({ event, context }) => {
    if (Number(event.args.originChainId) !== ETH) return;
    const updated = event.args.relayExecutionInfo?.updatedRecipient as string | undefined;
    const recipient =
      updated && updated.toLowerCase() !== ZERO ? updated : event.args.recipient;
    await insertEdge(context as DbCtx, {
      bridge: "across",
      direction: "eth_to_base",
      srcChainId: ETH,
      dstChainId: BASE,
      srcAddress: event.args.depositor,
      dstAddress: recipient,
      token: String(event.args.outputToken).toLowerCase(),
      amount: event.args.outputAmount,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  });

  ponder.on("AcrossSpokeBase:V3FundsDeposited", async ({ event, context }) => {
    if (Number(event.args.destinationChainId) !== ETH) return;
    await insertEdge(context as DbCtx, {
      bridge: "across",
      direction: "base_to_eth",
      srcChainId: BASE,
      dstChainId: ETH,
      srcAddress: event.args.depositor,
      dstAddress: event.args.recipient,
      token: String(event.args.inputToken).toLowerCase(),
      amount: event.args.inputAmount,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  });

  ponder.on("AcrossSpokeEth:V3FundsDeposited", async ({ event, context }) => {
    if (Number(event.args.destinationChainId) !== BASE) return;
    await insertEdge(context as DbCtx, {
      bridge: "across",
      direction: "eth_to_base",
      srcChainId: ETH,
      dstChainId: BASE,
      srcAddress: event.args.depositor,
      dstAddress: event.args.recipient,
      token: String(event.args.inputToken).toLowerCase(),
      amount: event.args.inputAmount,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  });

  ponder.on("AcrossSpokeEth:FilledV3Relay", async ({ event, context }) => {
    if (Number(event.args.originChainId) !== BASE) return;
    const updated = event.args.relayExecutionInfo?.updatedRecipient as string | undefined;
    const recipient =
      updated && updated.toLowerCase() !== ZERO ? updated : event.args.recipient;
    await insertEdge(context as DbCtx, {
      bridge: "across",
      direction: "base_to_eth",
      srcChainId: BASE,
      dstChainId: ETH,
      srcAddress: event.args.depositor,
      dstAddress: recipient,
      token: String(event.args.outputToken).toLowerCase(),
      amount: event.args.outputAmount,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  });
}

// --- Hop classic ETH + USDC.e ---
if (indexThirdPartyBridges() && indexHopBridges()) {
  ponder.on("HopEthL1:TransferSentToL2", async ({ event, context }) => {
    if (Number(event.args.chainId) !== BASE) return;
    const from = event.transaction.from;
    if (!from) return;
    await insertEdge(context as DbCtx, {
      bridge: "hop",
      direction: "eth_to_base",
      srcChainId: ETH,
      dstChainId: BASE,
      srcAddress: from,
      dstAddress: event.args.recipient,
      token: "eth",
      amount: event.args.amount,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  });

  ponder.on("HopUsdceL1:TransferSentToL2", async ({ event, context }) => {
    if (Number(event.args.chainId) !== BASE) return;
    const from = event.transaction.from;
    if (!from) return;
    await insertEdge(context as DbCtx, {
      bridge: "hop",
      direction: "eth_to_base",
      srcChainId: ETH,
      dstChainId: BASE,
      srcAddress: from,
      dstAddress: event.args.recipient,
      token: "usdce",
      amount: event.args.amount,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  });

  ponder.on("HopEthBaseL2:TransferSent", async ({ event, context }) => {
    if (Number(event.args.chainId) !== ETH) return;
    const from = event.transaction.from;
    if (!from) return;
    await insertEdge(context as DbCtx, {
      bridge: "hop",
      direction: "base_to_eth",
      srcChainId: BASE,
      dstChainId: ETH,
      srcAddress: from,
      dstAddress: event.args.recipient,
      token: "eth",
      amount: event.args.amount,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  });

  ponder.on("HopUsdceBaseL2:TransferSent", async ({ event, context }) => {
    if (Number(event.args.chainId) !== ETH) return;
    const from = event.transaction.from;
    if (!from) return;
    await insertEdge(context as DbCtx, {
      bridge: "hop",
      direction: "base_to_eth",
      srcChainId: BASE,
      dstChainId: ETH,
      srcAddress: from,
      dstAddress: event.args.recipient,
      token: "usdce",
      amount: event.args.amount,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  });
}

// --- Stargate OFT guid-join (defaults: native + USDC on each chain) ---
if (indexThirdPartyBridges()) {
  const baseN = stargateBasePools().length;
  const ethN = stargateEthPools().length;

  if (baseN > 0) {
    ponder.on("StargateBase0:OFTSent", async ({ event, context }) => {
      await onOftSent(context as DbCtx, {
        guid: event.args.guid,
        dstEid: Number(event.args.dstEid),
        fromAddress: event.args.fromAddress,
        amount: event.args.amountSentLD,
        srcChainId: BASE,
        txHash: event.transaction.hash,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
      });
    });
    ponder.on("StargateBase0:OFTReceived", async ({ event, context }) => {
      await onOftReceived(context as DbCtx, {
        guid: event.args.guid,
        srcEid: Number(event.args.srcEid),
        toAddress: event.args.toAddress,
        amount: event.args.amountReceivedLD,
        dstChainId: BASE,
        txHash: event.transaction.hash,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
      });
    });
  }
  if (baseN > 1) {
    ponder.on("StargateBase1:OFTSent", async ({ event, context }) => {
      await onOftSent(context as DbCtx, {
        guid: event.args.guid,
        dstEid: Number(event.args.dstEid),
        fromAddress: event.args.fromAddress,
        amount: event.args.amountSentLD,
        srcChainId: BASE,
        txHash: event.transaction.hash,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
      });
    });
    ponder.on("StargateBase1:OFTReceived", async ({ event, context }) => {
      await onOftReceived(context as DbCtx, {
        guid: event.args.guid,
        srcEid: Number(event.args.srcEid),
        toAddress: event.args.toAddress,
        amount: event.args.amountReceivedLD,
        dstChainId: BASE,
        txHash: event.transaction.hash,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
      });
    });
  }

  if (ethN > 0) {
    ponder.on("StargateEth0:OFTSent", async ({ event, context }) => {
      await onOftSent(context as DbCtx, {
        guid: event.args.guid,
        dstEid: Number(event.args.dstEid),
        fromAddress: event.args.fromAddress,
        amount: event.args.amountSentLD,
        srcChainId: ETH,
        txHash: event.transaction.hash,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
      });
    });
    ponder.on("StargateEth0:OFTReceived", async ({ event, context }) => {
      await onOftReceived(context as DbCtx, {
        guid: event.args.guid,
        srcEid: Number(event.args.srcEid),
        toAddress: event.args.toAddress,
        amount: event.args.amountReceivedLD,
        dstChainId: ETH,
        txHash: event.transaction.hash,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
      });
    });
  }
  if (ethN > 1) {
    ponder.on("StargateEth1:OFTSent", async ({ event, context }) => {
      await onOftSent(context as DbCtx, {
        guid: event.args.guid,
        dstEid: Number(event.args.dstEid),
        fromAddress: event.args.fromAddress,
        amount: event.args.amountSentLD,
        srcChainId: ETH,
        txHash: event.transaction.hash,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
      });
    });
    ponder.on("StargateEth1:OFTReceived", async ({ event, context }) => {
      await onOftReceived(context as DbCtx, {
        guid: event.args.guid,
        srcEid: Number(event.args.srcEid),
        toAddress: event.args.toAddress,
        amount: event.args.amountReceivedLD,
        dstChainId: ETH,
        txHash: event.transaction.hash,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
      });
    });
  }
}
