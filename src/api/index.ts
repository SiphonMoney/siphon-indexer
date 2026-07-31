import { db } from "ponder:api";
import schema from "ponder:schema";
import { and, asc, count, desc, eq, gte } from "drizzle-orm";
import { Hono } from "hono";

const app = new Hono();

const MAX_PAGE = 100_000;

/**
 * GET /leaves?chainId=&asset=&fromIndex=&limit=
 *
 * Returns an ordered page of merkle leaves. Clients sync incrementally with fromIndex =
 * their next dense index (usually leaves.length). Always includes tipRoot/totalCount/
 * tipBlockNumber so callers can verify against on-chain getRoot()/getSize() and bound
 * RPC catch-up to tipBlock−overlap instead of deploy→head.
 *
 * contiguous=false means the page is not a dense [fromIndex, fromIndex+count) run —
 * clients MUST full-resync (fromIndex=0), never append.
 */
app.get("/leaves", async (c) => {
  const chainId = Number(c.req.query("chainId"));
  const asset = (c.req.query("asset") || "").toUpperCase();
  const fromIndexRaw = c.req.query("fromIndex");
  const fromIndex = fromIndexRaw === undefined || fromIndexRaw === "" ? 0 : Number(fromIndexRaw);
  const limitRaw = c.req.query("limit");
  const limit =
    limitRaw === undefined || limitRaw === ""
      ? undefined
      : Math.min(MAX_PAGE, Math.max(1, Number(limitRaw)));

  if (!chainId || !asset) {
    return c.json({ error: "chainId and asset are required" }, 400);
  }
  if (!Number.isFinite(fromIndex) || fromIndex < 0 || !Number.isInteger(fromIndex)) {
    return c.json({ error: "fromIndex must be a non-negative integer" }, 400);
  }
  if (limitRaw !== undefined && limitRaw !== "" && (!Number.isFinite(limit!) || limit! < 1)) {
    return c.json({ error: "limit must be a positive integer" }, 400);
  }

  const where = and(eq(schema.merkleLeaf.chainId, chainId), eq(schema.merkleLeaf.asset, asset));

  const [totalRow] = await db.select({ n: count() }).from(schema.merkleLeaf).where(where);
  const totalCount = Number(totalRow?.n ?? 0);

  const [tip] = await db
    .select({
      leafIndex: schema.merkleLeaf.leafIndex,
      root: schema.merkleLeaf.root,
      leaf: schema.merkleLeaf.leaf,
      blockNumber: schema.merkleLeaf.blockNumber,
    })
    .from(schema.merkleLeaf)
    .where(where)
    .orderBy(desc(schema.merkleLeaf.leafIndex))
    .limit(1);

  let q = db
    .select({
      leafIndex: schema.merkleLeaf.leafIndex,
      leaf: schema.merkleLeaf.leaf,
      root: schema.merkleLeaf.root,
    })
    .from(schema.merkleLeaf)
    .where(and(where, gte(schema.merkleLeaf.leafIndex, BigInt(fromIndex))))
    .orderBy(asc(schema.merkleLeaf.leafIndex))
    .$dynamic();

  if (limit !== undefined) {
    q = q.limit(limit);
  }

  const rows = await q;

  let contiguous = true;
  for (let i = 0; i < rows.length; i++) {
    if (Number(rows[i].leafIndex) !== fromIndex + i) {
      contiguous = false;
      break;
    }
  }

  // Also flag a hole below fromIndex when doing a full sync from 0: tip says we have
  // totalCount leaves but dense 0..totalCount-1 is broken if tipLeafIndex !== totalCount-1.
  const tipLeafIndex = tip ? Number(tip.leafIndex) : null;
  if (fromIndex === 0 && totalCount > 0 && tipLeafIndex !== totalCount - 1) {
    contiguous = false;
  }

  return c.json({
    chainId,
    asset,
    fromIndex,
    count: rows.length,
    totalCount,
    nextIndex: contiguous ? fromIndex + rows.length : fromIndex,
    tipRoot: tip?.root ?? null,
    tipLeafIndex,
    tipBlockNumber: tip ? Number(tip.blockNumber) : null,
    contiguous,
    leaves: rows.map((r) => r.leaf),
  });
});

app.get("/deposits", async (c) => {
  const chainId = Number(c.req.query("chainId"));
  const precommitment = (c.req.query("precommitment") || "").trim();
  if (!chainId || !precommitment) {
    return c.json({ error: "chainId and precommitment are required" }, 400);
  }

  const rows = await db
    .select()
    .from(schema.vaultDeposit)
    .where(
      and(
        eq(schema.vaultDeposit.chainId, chainId),
        eq(schema.vaultDeposit.precommitment, precommitment),
      ),
    )
    .limit(1);

  if (rows.length === 0) return c.json({ found: false });
  const row = rows[0];
  return c.json({
    found: true,
    amount: row.amount,
    commitment: row.commitment,
    precommitment: row.precommitment,
    blockNumber: Number(row.blockNumber),
    txHash: row.txHash,
  });
});

export default app;
