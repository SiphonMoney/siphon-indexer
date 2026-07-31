# Siphon Indexer

A [Ponder](https://ponder.sh) service that indexes Siphon's on-chain privacy-pool state into
PostgreSQL, so the dapp can reconcile balances with a single query instead of thousands of
`eth_getLogs` calls.

> **Why this exists:** the browser used to rebuild each user's private balance by scanning every
> block from the vault deploy block for `LeafInserted` events. On free/public RPCs that meant
> thousands of chunked `eth_getLogs` requests per balance check (visible as a flood of
> `POST /api/rpc?chainId=...`). The indexer does that scan **once**, keeps it live, and serves
> it over HTTP.

---

## Contents

- [Architecture](#architecture)
- [What it indexes](#what-it-indexes)
- [Quick start (local)](#quick-start-local)
- [Configuration](#configuration)
- [Database](#database)
- [API](#api)
- [How the frontend uses it](#how-the-frontend-uses-it)
- [Operations](#operations)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

For production deploy steps see **[DEPLOYMENT.md](./DEPLOYMENT.md)**.
For internals and data flow see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## Architecture

`siphon-indexer` is its **own repository / deployable**, a sibling of `siphon-app`,
`siphon-fhe`, and `siphon-contracts`. Repos communicate only over the network (HTTP + a shared
Postgres server), never by importing each other's code.

```
On-chain events                Indexer                     Backend                Frontend
────────────────      ──────────────────────      ─────────────────────      ──────────────
MerkleTree.LeafInserted ─┐
Vault.Deposited ─────────┼──▶ Ponder ──▶ Postgres ──▶ trade-executor ──▶ siphon-app
                         │    (this repo)  siphon_indexer   /vault-index/*    leafIndexClient.ts
                         │                                                          │
                         └───────────────────────────────────────────────── fallback: /api/rpc
```

**The frontend never talks to Ponder directly in production.** It calls the trade-executor's
`/vault-index/*` endpoints, which read the same Postgres database Ponder writes to. If the
indexer is unreachable, the frontend falls back to the legacy `eth_getLogs` scan, so nothing
breaks — it just gets slow again.

---

## What it indexes

Siphon deploys **one Vault per asset per chain** via `CREATE2`, and each Vault creates its own
`MerkleTree` in its constructor. There are 4 of each today:

| Chain | Chain ID | Assets |
|---|---|---|
| Base mainnet | `8453` | ETH, USDC |
| Ethereum Sepolia | `11155111` | ETH, USDC |

| Contract | Event | Indexed into | Used for |
|---|---|---|---|
| `MerkleTree` | `LeafInserted(index, leaf, root)` | `merkle_leaf` | Spendable-balance reconciliation |
| `Vault` | `Deposited(depositor, amount, commitment, precommitment)` | `vault_deposit` | Vault-mode swap output-note resolution |

Addresses are not emitted by any registry event, so they are resolved once from each chain's
`Entrypoint` via `npm run resolve-addresses` (see [Configuration](#configuration)).

---

## Quick start (local)

Prerequisites: Node ≥ 18.14, a reachable Postgres, and RPC URLs for Base + Ethereum Sepolia.

```bash
cd siphon-indexer
npm install

# 1. Configure — Ponder dev loads .env.local (NOT .env)
cp .env.example .env.local

# 2. Resolve Vault + MerkleTree addresses from the Entrypoints, append to .env.local
npm run resolve-addresses >> .env.local

# 3. Start (historical backfill → live sync; API + GraphQL on :42069)
npm run dev
```

Verify:

```bash
curl "http://localhost:42069/leaves?chainId=8453&asset=ETH"
# {"chainId":8453,"asset":"ETH","count":0,"leaves":[]}   ← count grows as backfill progresses
```

> **First run does a full historical backfill** from the vault deploy block. On public RPCs this
> is slow (hours). Use a dedicated Alchemy/Infura key (see below) to speed it up dramatically.
> Ponder caches synced ranges, so subsequent restarts resume instead of rescanning.

---

## Configuration

All configuration is via environment variables. See [`.env.example`](./.env.example).

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string for the `siphon_indexer` database |
| `PONDER_RPC_URL_8453` | ✅ | Base mainnet RPC (use a dedicated key in prod) |
| `PONDER_RPC_URL_11155111` | ✅ | Ethereum Sepolia RPC |
| `BASE_DEPLOY_BLOCK` | — | Earliest block to scan on Base (default `47815995`) |
| `SEPOLIA_DEPLOY_BLOCK` | — | Earliest block to scan on Sepolia (default `11130700`) |
| `MERKLE_TREE_BASE_ETH` | ✅* | MerkleTree address (ETH vault, Base) |
| `MERKLE_TREE_BASE_USDC` | ✅* | MerkleTree address (USDC vault, Base) |
| `MERKLE_TREE_SEPOLIA_ETH` | ✅* | MerkleTree address (ETH vault, Sepolia) |
| `MERKLE_TREE_SEPOLIA_USDC` | ✅* | MerkleTree address (USDC vault, Sepolia) |
| `VAULT_BASE_ETH` | ✅* | Vault address (ETH, Base) |
| `VAULT_BASE_USDC` | ✅* | Vault address (USDC, Base) |
| `VAULT_SEPOLIA_ETH` | ✅* | Vault address (ETH, Sepolia) |
| `VAULT_SEPOLIA_USDC` | ✅* | Vault address (USDC, Sepolia) |

`*` Contract address vars are populated by `npm run resolve-addresses`. Any contract whose env
var is empty is simply skipped in `ponder.config.ts`, so you can index a subset while testing.

### Resolving contract addresses

```bash
npm run resolve-addresses          # prints to stdout + logs to stderr
npm run resolve-addresses >> .env.local
```

The script reads each chain's `Entrypoint.getVault(asset)` then `Vault.merkleTree()` and emits
ready-to-paste env lines. Re-run it whenever contracts are redeployed. Its inputs
(`ENTRYPOINT_*`, `USDC_*`) also live in `.env.example`.

---

## Database

Ponder owns and manages its schema in the target database. It creates the two application
tables plus internal bookkeeping tables (`_ponder_meta`, `_ponder_checkpoint`, `_reorg__*`).

### `merkle_leaf`

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | `${chainId}-${merkleTree}-${leafIndex}` |
| `chain_id` | integer | `8453` / `11155111` |
| `asset` | text | `ETH` / `USDC` |
| `merkle_tree` | hex | Emitting MerkleTree address |
| `leaf_index` | bigint | Position in the tree |
| `leaf` | text | Commitment (uint256 as decimal string) |
| `root` | text | Root after insert |
| `block_number` | bigint | |
| `block_timestamp` | bigint | |
| `tx_hash` | hex | |

Indexes: `(chain_id, asset)`, `(leaf)`, `(merkle_tree)`.

### `vault_deposit`

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | `${txHash}-${logIndex}` |
| `chain_id` | integer | |
| `asset` | text | |
| `vault` | hex | Emitting Vault address |
| `depositor` | hex | |
| `amount` | text | uint256 as decimal string |
| `commitment` | text | |
| `precommitment` | text | Lookup key for output-note resolution |
| `block_number` | bigint | |
| `block_timestamp` | bigint | |
| `tx_hash` | hex | |

Indexes: `(chain_id, precommitment)`, `(commitment)`, `(chain_id, asset)`.

> **uint256 values are stored as decimal strings**, not numeric, because Poseidon commitments
> exceed Postgres's `numeric`/`bigint` safe range. Consumers parse them with `BigInt`.

---

## API

Two API surfaces expose the same data.

### 1. Ponder API (this service, port `42069`)

Custom HTTP routes in `src/api/index.ts` (Hono + Drizzle):

| Method | Route | Query params | Returns |
|---|---|---|---|
| `GET` | `/leaves` | `chainId`, `asset`, optional `fromIndex`, `limit` | `{ chainId, asset, fromIndex, count, totalCount, nextIndex, tipRoot, tipLeafIndex, tipBlockNumber, contiguous, leaves: string[] }` |
| `GET` | `/deposits` | `chainId`, `precommitment` | `{ found, amount?, commitment?, ... }` |
| `GET` | `/health` | — | Ponder's built-in readiness endpoint (reserved) |
| `POST` | `/graphql` | — | Auto-generated GraphQL over the schema |

```bash
curl "http://localhost:42069/leaves?chainId=8453&asset=ETH"
curl "http://localhost:42069/leaves?chainId=8453&asset=ETH&fromIndex=100"
curl "http://localhost:42069/deposits?chainId=8453&precommitment=123456789"
```

Incremental sync: clients pass `fromIndex` = their dense leaf count. If `contiguous` is
false, discard local state and resync from `fromIndex=0`. Always verify `tipRoot` / folded
root against on-chain `getRoot()` / `rootExists()` — never trust size alone.

> In production this port is **internal only** — don't expose it publicly. The frontend uses the
> trade-executor proxy below.

### 2. trade-executor proxy (public, port `5005`)

`siphon-fhe/trade-executor/vault_index.py` reads the indexer Postgres directly and serves:

| Method | Route | Query params | Returns |
|---|---|---|---|
| `GET` | `/vault-index/health` | — | `{ ok, leafCount }` |
| `GET` | `/vault-index/leaves` | `chainId`, `asset` | `{ chainId, asset, count, leaves }` |
| `GET` | `/vault-index/deposits` | `chainId`, `precommitment` | `{ found, amount?, commitment? }` |

This is what the browser actually calls (CORS is already configured for the app origin, and the
executor is already a public service).

---

## How the frontend uses it

`siphon-app/src/lib/leafIndexClient.ts` wraps the trade-executor endpoints with a short-lived
in-memory cache. `zkHandler.ts` consumes it:

- `getOnChainLeaves()` → `fetchIndexedLeaves()` first; falls back to `eth_getLogs` on miss/error.
- `resolveOutputNote()` → `fetchIndexedDeposit()` first; falls back to `eth_getLogs`.

No frontend contract changes were needed — indexed data flows through the existing
balance-reconciliation pipeline. If the indexer is down, users transparently get the old
(slower) behavior.

---

## Operations

```bash
# Dev (hot reload, loads .env.local)
npm run dev

# Production (no reload)
npm run start

# Regenerate ponder-env.d.ts types after schema/config changes
npm run codegen

# Re-resolve contract addresses
npm run resolve-addresses
```

### Monitoring sync progress

```bash
# Leaf counts by chain/asset
psql "$DATABASE_URL" -c "SELECT chain_id, asset, COUNT(*) FROM merkle_leaf GROUP BY 1,2;"

# Ponder sync checkpoints (how far each chain has synced)
psql "$DATABASE_URL" -c "SELECT chain_name, chain_id FROM _ponder_checkpoint;"

# API smoke test
curl "http://localhost:42069/leaves?chainId=8453&asset=ETH"
```

---

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full guide. In short:

1. Build + push the Docker image to your registry (e.g. ECR `siphon-indexer`).
2. Provision a `siphon_indexer` database on your Postgres server (RDS in prod).
3. Run the container with `ponder start` and the env vars above.
4. Point trade-executor at the same DB via `INDEXER_DB_URI`.
5. Keep port `42069` internal; the frontend uses the trade-executor proxy.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Missing env var: DATABASE_URL` on `npm run dev` | Ponder dev reads `.env.local`, not `.env` | `cp .env.example .env.local` |
| Backfill stuck near 0% / very slow | Public RPC rate limits | Set `PONDER_RPC_URL_*` to Alchemy/Infura keys |
| `count: 0` from `/leaves` | Backfill hasn't reached blocks with deposits yet | Wait for sync; check `_ponder_checkpoint` |
| `API function file not found` | Missing `src/api/index.ts` | Present in this repo; ensure it's built |
| `API route "/health" is reserved` | Custom `/health` route | Removed — Ponder owns `/health` |
| Frontend still floods `/api/rpc` | Indexer unreachable → RPC fallback | Verify `/vault-index/health` on trade-executor |
| Wrong/empty leaves after redeploy | Stale contract addresses | Re-run `resolve-addresses`, restart |
