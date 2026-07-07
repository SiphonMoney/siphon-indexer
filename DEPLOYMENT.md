# Deployment

`siphon-indexer` deploys as an independent, long-running Docker service — the same pattern as
`siphon-fhe`. It needs three things: a Postgres database (`siphon_indexer`), RPC endpoints, and
the resolved contract addresses.

- [Topology](#topology)
- [Prerequisites](#prerequisites)
- [Step 1 — Provision the database](#step-1--provision-the-database)
- [Step 2 — Resolve contract addresses](#step-2--resolve-contract-addresses)
- [Step 3 — Build & push the image](#step-3--build--push-the-image)
- [Step 4 — Run the indexer](#step-4--run-the-indexer)
- [Step 5 — Wire the trade-executor](#step-5--wire-the-trade-executor)
- [Step 6 — Verify](#step-6--verify)
- [Environments](#environments)
- [Upgrades & schema changes](#upgrades--schema-changes)
- [Runbook](#runbook)

---

## Topology

Run the indexer alongside the trade-executor. Both point at the same Postgres **server**, using
a dedicated `siphon_indexer` **database** (separate from `siphon_strategies`).

```
┌──────────────────────────── Host / EC2 ────────────────────────────┐
│  trade-executor :5005 ──┐                                           │
│  fhe-engine     :5001   │  (public via ALB/Caddy)                   │
│  siphon-indexer :42069 ─┘  (INTERNAL ONLY — do not expose)          │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │
                    Postgres (local container or RDS)
                    ├── siphon_indexer     ← Ponder writes, executor reads
                    └── siphon_strategies  ← trade-executor
```

The frontend calls `trade-executor /vault-index/*`, never `:42069` directly.

---

## Prerequisites

- Docker + a container registry (e.g. AWS ECR).
- A Postgres server reachable from both the indexer and the trade-executor.
- Dedicated RPC endpoints (Alchemy/Infura) for Base (`8453`) and Ethereum Sepolia (`11155111`).
  Public RPCs make the initial backfill impractically slow.

---

## Step 1 — Provision the database

Create the dedicated database on your Postgres server.

**Managed Postgres (RDS/Supabase):**

```sql
CREATE DATABASE siphon_indexer;
-- grant to the app role if not the owner:
GRANT ALL PRIVILEGES ON DATABASE siphon_indexer TO siphon;
```

**Docker Postgres (dev/staging):** the compose stack auto-creates it on first boot via
`siphon-fhe/docker/postgres-init/01-create-indexer-db.sql`. If Postgres already had a volume
before that file existed, create it manually:

```bash
docker exec siphon-postgres psql -U siphon -d siphon_strategies \
  -c "CREATE DATABASE siphon_indexer;"
```

Ponder creates all tables itself on first start — no migrations to run.

---

## Step 2 — Resolve contract addresses

Vault/MerkleTree addresses aren't emitted by events, so resolve them from the Entrypoints once
per environment (and again after any contract redeploy):

```bash
cd siphon-indexer
npm install
npm run resolve-addresses
```

Copy the printed `VAULT_*` / `MERKLE_TREE_*` lines into your deployment env (SSM, `.env`,
compose, or CI secrets). They rarely change.

---

## Step 3 — Build & push the image

```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

aws ecr create-repository --repository-name siphon-indexer --region $AWS_REGION || true
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $ECR

docker build -t siphon-indexer .
docker tag siphon-indexer:latest $ECR/siphon-indexer:latest
docker push $ECR/siphon-indexer:latest
```

The image runs `npm run start` (`ponder start`) — the production, no-reload mode.

---

## Step 4 — Run the indexer

The container needs `DATABASE_URL`, both RPC URLs, and the resolved addresses.

**Plain Docker:**

```bash
docker run -d --name siphon-indexer \
  --restart unless-stopped \
  --network siphon-network \
  -e DATABASE_URL="postgresql://siphon:PASS@postgres:5432/siphon_indexer" \
  -e PONDER_RPC_URL_8453="https://base-mainnet.g.alchemy.com/v2/KEY" \
  -e PONDER_RPC_URL_11155111="https://eth-sepolia.g.alchemy.com/v2/KEY" \
  -e BASE_DEPLOY_BLOCK=47815995 \
  -e SEPOLIA_DEPLOY_BLOCK=11130700 \
  -e MERKLE_TREE_BASE_ETH=0x... \
  -e MERKLE_TREE_BASE_USDC=0x... \
  -e MERKLE_TREE_SEPOLIA_ETH=0x... \
  -e MERKLE_TREE_SEPOLIA_USDC=0x... \
  -e VAULT_BASE_ETH=0x... \
  -e VAULT_BASE_USDC=0x... \
  -e VAULT_SEPOLIA_ETH=0x... \
  -e VAULT_SEPOLIA_USDC=0x... \
  $ECR/siphon-indexer:latest
```

**docker-compose (staging convenience — in the `siphon-fhe` stack):** a `siphon-indexer` service
is already defined and reads these vars from the environment. Bring it up with:

```bash
cd siphon-fhe
docker compose up -d postgres siphon-indexer trade-executor
```

> In production, pull the image from ECR rather than building `../siphon-indexer` from source, to
> keep the repos independent.

---

## Step 5 — Wire the trade-executor

Give the trade-executor read access to the same database. In `siphon-fhe` deployment env:

```bash
INDEXER_DB_URI=postgresql://siphon:PASS@postgres:5432/siphon_indexer
```

`vault_index.py` is already registered in `app.py`; it exposes `/vault-index/*`. Redeploy the
trade-executor after setting the var. If `INDEXER_DB_URI` is unset, the endpoints return 503 and
the frontend simply uses its RPC fallback.

No changes are required in `siphon-app` — it already calls these endpoints via
`leafIndexClient.ts` and points at `NEXT_PUBLIC_TRADE_EXECUTOR_URL`.

---

## Step 6 — Verify

```bash
# Indexer up (internal)
curl "http://INDEXER_HOST:42069/leaves?chainId=8453&asset=ETH"

# Public path through the trade-executor
curl "https://YOUR_EXECUTOR/vault-index/health"
curl "https://YOUR_EXECUTOR/vault-index/leaves?chainId=8453&asset=ETH"

# Sync progress
psql "$DATABASE_URL" -c "SELECT chain_id, asset, COUNT(*) FROM merkle_leaf GROUP BY 1,2;"
```

The first backfill takes a while; `count` climbs as it catches up. Once at head, new deposits
appear within seconds.

---

## Environments

| Setting | Dev | Staging | Production |
|---|---|---|---|
| Postgres | Docker container | Docker or RDS | RDS |
| RPC | public OK (slow) | dedicated key | dedicated key |
| Ponder mode | `npm run dev` (`.env.local`) | `npm run start` | `npm run start` |
| `:42069` exposure | localhost | internal | internal only |
| Image source | local build | ECR | ECR |

---

## Upgrades & schema changes

- **Code-only change (indexing logic/API):** rebuild image, redeploy. Ponder reuses cached
  synced ranges where possible.
- **Schema change (`ponder.schema.ts`):** Ponder may rebuild tables. Plan for a re-backfill
  window; the frontend falls back to RPC meanwhile. Run `npm run codegen` locally first to
  update types.
- **Contract redeploy:** re-run `resolve-addresses`, update env, restart. New addresses backfill
  from their deploy block.
- **RPC change:** update `PONDER_RPC_URL_*`, restart. Cached ranges are preserved.

---

## Runbook

| Symptom | Check | Action |
|---|---|---|
| `/vault-index/*` → 503 | `INDEXER_DB_URI` set on executor? | Set it, redeploy executor |
| `count` stuck at 0 | `_ponder_checkpoint` progress; RPC rate limits | Use dedicated RPC; wait for backfill |
| Frontend flooding `/api/rpc` | `/vault-index/health` reachable? | Restart indexer / fix DB connectivity |
| Container restart loop | `DATABASE_URL` + address vars present? | Fix env; addresses come from `resolve-addresses` |
| Stale/empty leaves after deploy | Addresses match current contracts? | Re-run `resolve-addresses`, restart |
| Backfill very slow | Which RPC is configured? | Switch `PONDER_RPC_URL_*` to Alchemy/Infura |

**Restart:**

```bash
docker restart siphon-indexer
docker logs -f siphon-indexer
```

**Full re-index (rare):** drop the `siphon_indexer` database, recreate it, restart the container.
Only necessary if the indexed data is corrupt or the schema changed incompatibly.
