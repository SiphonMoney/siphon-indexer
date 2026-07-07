import { db } from "ponder:api";
import schema from "ponder:schema";
import { and, eq } from "drizzle-orm";
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

export default app;
