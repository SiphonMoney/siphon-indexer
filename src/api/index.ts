import { db } from "ponder:api";
import schema from "ponder:schema";
import { and, desc, eq, gte } from "drizzle-orm";
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

/**
 * GET /mixer-touches?chainId=&address=&direction=&sinceTs=&limit=
 * Association set facts: Veil/Tornado-compatible pool counterparties on Base.
 */
app.get("/mixer-touches", async (c) => {
  const chainId = Number(c.req.query("chainId") || "8453");
  const address = (c.req.query("address") || "").trim().toLowerCase();
  const direction = (c.req.query("direction") || "").trim();
  const sinceTsRaw = c.req.query("sinceTs");
  const sinceTs =
    sinceTsRaw === undefined || sinceTsRaw === "" ? undefined : BigInt(sinceTsRaw);
  const limit = Math.min(500, Math.max(1, Number(c.req.query("limit") || "50")));

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return c.json({ error: "address must be a 0x-prefixed 20-byte hex" }, 400);
  }

  const filters = [
    eq(schema.tornadoTouch.chainId, chainId),
    eq(schema.tornadoTouch.counterparty, address as `0x${string}`),
  ];
  if (direction === "from_pool" || direction === "to_pool") {
    filters.push(eq(schema.tornadoTouch.direction, direction));
  }
  if (sinceTs !== undefined) {
    filters.push(gte(schema.tornadoTouch.blockTimestamp, sinceTs));
  }

  const rows = await db
    .select()
    .from(schema.tornadoTouch)
    .where(and(...filters))
    .orderBy(desc(schema.tornadoTouch.blockTimestamp))
    .limit(limit);

  return c.json({
    chainId,
    address,
    count: rows.length,
    touches: rows.map((r) => ({
      pool: r.pool,
      poolLabel: r.poolLabel,
      direction: r.direction,
      blockNumber: Number(r.blockNumber),
      blockTimestamp: Number(r.blockTimestamp),
      txHash: r.txHash,
    })),
  });
});

/**
 * GET /bridge-peers?chainId=&address=&sinceTs=&limit=
 * Official Base↔ETH StandardBridge counterparties for cross-chain association.
 */
app.get("/bridge-peers", async (c) => {
  const chainId = Number(c.req.query("chainId") || "8453");
  const address = (c.req.query("address") || "").trim().toLowerCase();
  const sinceTsRaw = c.req.query("sinceTs");
  const sinceTs =
    sinceTsRaw === undefined || sinceTsRaw === "" ? undefined : BigInt(sinceTsRaw);
  const limit = Math.min(500, Math.max(1, Number(c.req.query("limit") || "50")));

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return c.json({ error: "address must be a 0x-prefixed 20-byte hex" }, 400);
  }

  const addr = address as `0x${string}`;
  const timeFilter = sinceTs !== undefined ? gte(schema.bridgeEdge.blockTimestamp, sinceTs) : undefined;

  const asDst = await db
    .select()
    .from(schema.bridgeEdge)
    .where(
      and(
        eq(schema.bridgeEdge.dstChainId, chainId),
        eq(schema.bridgeEdge.dstAddress, addr),
        ...(timeFilter ? [timeFilter] : []),
      ),
    )
    .orderBy(desc(schema.bridgeEdge.blockTimestamp))
    .limit(limit);

  const asSrc = await db
    .select()
    .from(schema.bridgeEdge)
    .where(
      and(
        eq(schema.bridgeEdge.srcChainId, chainId),
        eq(schema.bridgeEdge.srcAddress, addr),
        ...(timeFilter ? [timeFilter] : []),
      ),
    )
    .orderBy(desc(schema.bridgeEdge.blockTimestamp))
    .limit(limit);

  const peers = [
    ...asDst.map((r) => ({
      peerAddress: r.srcAddress,
      peerChainId: r.srcChainId,
      direction: r.direction,
      bridge: r.bridge,
      token: r.token,
      blockTimestamp: Number(r.blockTimestamp),
      txHash: r.txHash,
    })),
    ...asSrc.map((r) => ({
      peerAddress: r.dstAddress,
      peerChainId: r.dstChainId,
      direction: r.direction,
      bridge: r.bridge,
      token: r.token,
      blockTimestamp: Number(r.blockTimestamp),
      txHash: r.txHash,
    })),
  ].slice(0, limit);

  return c.json({ chainId, address, count: peers.length, peers });
});

export default app;
