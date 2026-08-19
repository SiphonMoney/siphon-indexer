import { db } from "ponder:api";
import schema from "ponder:schema";
import { and, asc, count, desc, eq, gte, max } from "drizzle-orm";
import { Hono } from "hono";

const app = new Hono();

const MAX_PAGE = 100_000;

const indexMixerTouches =
  !["0", "false", "no"].includes((process.env.INDEX_MIXER_TOUCHES ?? "1").trim().toLowerCase());

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
      newLabel: r.newLabel,
      blockTimestamp: Number(r.blockTimestamp),
      txHash: r.txHash,
    })),
    source: "ponder",
  });
});

/**
 * GET /mixer-touches?chainId=&address=&direction=&sinceTs=&limit=
 * Association set facts: Veil/Tornado-compatible pool counterparties on Base.
 */
app.get("/mixer-touches", async (c) => {
  if (!indexMixerTouches) {
    return c.json({ error: "mixer_touches_disabled" }, 503);
  }
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
