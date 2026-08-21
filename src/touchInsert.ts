import { type Context } from "ponder:registry";
import schema from "ponder:schema";

const ZERO = "0x0000000000000000000000000000000000000000";

export type TouchDirection = "from_pool" | "to_pool";

export async function insertTornadoTouch(
  context: Context,
  args: {
    chainId: number;
    pool: `0x${string}`;
    poolLabel: string;
    counterparty: string;
    direction: TouchDirection;
    blockNumber: bigint;
    blockTimestamp: bigint;
    txHash: `0x${string}`;
    logOrCallId: string;
  },
) {
  const counterparty = args.counterparty.toLowerCase() as `0x${string}`;
  if (!counterparty.startsWith("0x") || counterparty.length !== 42 || counterparty === ZERO) {
    return;
  }
  const pool = args.pool.toLowerCase() as `0x${string}`;
  const id = `${args.chainId}-${pool}-${args.direction}-${counterparty}-${args.logOrCallId}`;

  await context.db.insert(schema.tornadoTouch).values({
    id,
    chainId: args.chainId,
    pool,
    poolLabel: args.poolLabel,
    counterparty,
    direction: args.direction,
    blockNumber: args.blockNumber,
    blockTimestamp: args.blockTimestamp,
    txHash: args.txHash,
  }).onConflictDoNothing();
}
