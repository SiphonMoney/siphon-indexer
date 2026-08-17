import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import { indexBaseBridges } from "../abis/CrossChainGraph";

const ZERO = "0x0000000000000000000000000000000000000000";
const BASE = 8453;
const ETH = 1;

async function insertEdge(
  context: {
    db: {
      insert: (table: typeof schema.bridgeEdge) => {
        values: (v: Record<string, unknown>) => Promise<unknown> & {
          onConflictDoNothing: () => Promise<unknown>;
        };
      };
    };
  },
  args: {
    direction: "eth_to_base" | "base_to_eth";
    srcChainId: number;
    dstChainId: number;
    srcAddress: string;
    dstAddress: string;
    token: string;
    amount: bigint;
    blockNumber: bigint;
    blockTimestamp: bigint;
    txHash: `0x${string}`;
    logIndex: number;
  },
) {
  const src = args.srcAddress.toLowerCase() as `0x${string}`;
  const dst = args.dstAddress.toLowerCase() as `0x${string}`;
  if (src === ZERO || dst === ZERO) return;

  const id = `${args.direction}-${args.txHash}-${args.logIndex}`;
  await context.db.insert(schema.bridgeEdge).values({
    id,
    bridge: "base_standard",
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
  }).onConflictDoNothing();
}

/**
 * L2 StandardBridge on Base:
 * - *BridgeFinalized = L1→L2 arrival (from=L1 sender, to=L2 recipient)
 * - *BridgeInitiated = L2→L1 start (from=L2 sender, to=L1 recipient)
 */
if (indexBaseBridges()) {
  ponder.on("BaseL2StandardBridge:ETHBridgeFinalized", async ({ event, context }) => {
    await insertEdge(context, {
      direction: "eth_to_base",
      srcChainId: ETH,
      dstChainId: BASE,
      srcAddress: event.args.from,
      dstAddress: event.args.to,
      token: "eth",
      amount: event.args.amount,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  });

  ponder.on("BaseL2StandardBridge:ERC20BridgeFinalized", async ({ event, context }) => {
    await insertEdge(context, {
      direction: "eth_to_base",
      srcChainId: ETH,
      dstChainId: BASE,
      srcAddress: event.args.from,
      dstAddress: event.args.to,
      token: `erc20:${String(event.args.localToken).toLowerCase()}`,
      amount: event.args.amount,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  });

  ponder.on("BaseL2StandardBridge:ETHBridgeInitiated", async ({ event, context }) => {
    await insertEdge(context, {
      direction: "base_to_eth",
      srcChainId: BASE,
      dstChainId: ETH,
      srcAddress: event.args.from,
      dstAddress: event.args.to,
      token: "eth",
      amount: event.args.amount,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  });

  ponder.on("BaseL2StandardBridge:ERC20BridgeInitiated", async ({ event, context }) => {
    await insertEdge(context, {
      direction: "base_to_eth",
      srcChainId: BASE,
      dstChainId: ETH,
      srcAddress: event.args.from,
      dstAddress: event.args.to,
      token: `erc20:${String(event.args.localToken).toLowerCase()}`,
      amount: event.args.amount,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
    });
  });
}
