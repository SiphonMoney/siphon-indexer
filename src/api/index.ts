import { db } from "ponder:api";
import schema from "ponder:schema";
import { and, count, desc, eq, max } from "drizzle-orm";
import { Hono } from "hono";

const app = new Hono();

app.get("/leaves", async (c) => {
  const chainId = Number(c.req.query("chainId"));
  const asset = (c.req.query("asset") || "").toUpperCase();
  if (!chainId || !asset) {
    return c.json({ error: "chainId and asset are required" }, 400);
  }

  const rows = await db
    .select({ leaf: schema.merkleLeaf.leaf })
    .from(schema.merkleLeaf)
    .where(and(eq(schema.merkleLeaf.chainId, chainId), eq(schema.merkleLeaf.asset, asset)))
    .orderBy(schema.merkleLeaf.leafIndex);

  return c.json({
    chainId,
    asset,
    count: rows.length,
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

/** Agent / Graph-client fallback: anonymity set size + deposit/swap counters. */
app.get("/anonymity-set", async (c) => {
  const chainId = Number(c.req.query("chainId"));
  const asset = (c.req.query("asset") || "").toUpperCase();
  if (!chainId || !asset) {
    return c.json({ error: "chainId and asset are required" }, 400);
  }

  const [leafRow] = await db
    .select({
      leafCount: count(),
      lastLeafAt: max(schema.merkleLeaf.blockTimestamp),
    })
    .from(schema.merkleLeaf)
    .where(and(eq(schema.merkleLeaf.chainId, chainId), eq(schema.merkleLeaf.asset, asset)));

  const [depositRow] = await db
    .select({ depositCount: count() })
    .from(schema.vaultDeposit)
    .where(and(eq(schema.vaultDeposit.chainId, chainId), eq(schema.vaultDeposit.asset, asset)));

  const [swapRow] = await db
    .select({ swapCount: count() })
    .from(schema.vaultSwap)
    .where(and(eq(schema.vaultSwap.chainId, chainId), eq(schema.vaultSwap.asset, asset)));

  return c.json({
    chainId,
    asset,
    leafCount: Number(leafRow?.leafCount ?? 0),
    depositCount: Number(depositRow?.depositCount ?? 0),
    swapCount: Number(swapRow?.swapCount ?? 0),
    lastLeafAt: leafRow?.lastLeafAt != null ? Number(leafRow.lastLeafAt) : null,
    source: "ponder",
  });
});

app.get("/swaps", async (c) => {
  const chainId = Number(c.req.query("chainId"));
  const limit = Math.min(Number(c.req.query("limit") || 10), 50);
  if (!chainId) {
    return c.json({ error: "chainId is required" }, 400);
  }

  const rows = await db
    .select()
    .from(schema.vaultSwap)
    .where(eq(schema.vaultSwap.chainId, chainId))
    .orderBy(desc(schema.vaultSwap.blockTimestamp))
    .limit(limit);

  return c.json({
    chainId,
    swaps: rows.map((r) => ({
      id: r.id,
      asset: r.asset,
      recipient: r.recipient,
      pool: r.pool,
      amountIn: r.amountIn,
      minAmountOut: r.minAmountOut,
      blockTimestamp: Number(r.blockTimestamp),
      txHash: r.txHash,
    })),
    source: "ponder",
  });
});

export default app;
