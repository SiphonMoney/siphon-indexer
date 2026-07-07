# Architecture

How `siphon-indexer` fits into the Siphon stack, why it exists, and how data flows end to end.

## The problem

Siphon is a privacy pool. A user's spendable balance can't be read from a single contract call —
it must be reconstructed from the set of Merkle-tree leaves (commitments) that belong to the
user's notes, cross-checked against on-chain nullifier state.

Originally the browser did this by scanning the chain directly:

```
getSpendableVaultBalance()
  └─ getOnChainLeaves()
       └─ eth_getLogs(LeafInserted, fromBlock=deployBlock, toBlock=latest)  // chunked
```

On public RPCs `eth_getLogs` is capped to small block ranges, so a single balance check fanned
out into **thousands** of chunked requests from the deploy block to head. Multiple components
(ConnectButton, WalletPanel, UserDash) each triggered this, producing the observed flood of
`POST /api/rpc?chainId=...` and a slow, rate-limited UX.

## The fix

Do the scan once, server-side, and keep it live. Ponder backfills historical events, then
follows the chain head, writing normalized rows into Postgres. Reads become a single indexed
SQL query.

```mermaid
flowchart LR
  subgraph chain["On-chain (Base + Eth Sepolia)"]
    MT["MerkleTree.LeafInserted"]
    V["Vault.Deposited"]
  end

  subgraph indexer["siphon-indexer (Ponder) — own repo"]
    H["src/MerkleTree.ts\nsrc/Vault.ts\n(indexing fns)"]
    A["src/api/index.ts\n(Hono routes :42069)"]
  end

  subgraph pg[("Postgres server")]
    DBI[("siphon_indexer\nmerkle_leaf, vault_deposit")]
    DBS[("siphon_strategies\n(trade-executor)")]
  end

  subgraph fhe["siphon-fhe (trade-executor) — own repo"]
    VX["vault_index.py\n/vault-index/* :5005"]
  end

  subgraph app["siphon-app — own repo"]
    LC["leafIndexClient.ts"]
    ZK["zkHandler.ts"]
    RPC["/api/rpc (fallback)"]
  end

  MT --> H
  V --> H
  H --> DBI
  DBI --> A
  DBI --> VX
  VX --> LC
  LC --> ZK
  ZK -. "on indexer miss/error" .-> RPC
```

## Repository boundaries

Each folder is an independent git repo. They integrate over the network only.

| Repo | Responsibility | Talks to |
|---|---|---|
| `siphon-contracts` | Solidity + ABIs; source of truth for addresses | — |
| `siphon-indexer` | Ponder: index events → Postgres; serve `/leaves`, `/deposits` | Postgres, RPC |
| `siphon-fhe` | trade-executor exposes `/vault-index/*` reading the indexer DB | Postgres |
| `siphon-app` | Browser reconciles balances via trade-executor, RPC fallback | trade-executor |

**Key rule:** the frontend never depends on Ponder directly. The trade-executor is the single
public read surface, so the indexer can be replaced or moved without touching the app.

## Why one Vault/MerkleTree per asset per chain

`Entrypoint.initializeVaults()` deploys a Vault per asset via `CREATE2`, and each `Vault`
constructor does `new MerkleTree(address(this))`. So:

- Addresses are deterministic but **not announced by any event** → we resolve them from
  `Entrypoint.getVault()` + `Vault.merkleTree()` once (`scripts/resolve-addresses.ts`).
- There are a fixed, small number of contracts (4 vaults + 4 trees today), so Ponder's config
  lists them statically rather than using a factory pattern.
- Each indexing function is registered explicitly per contract (`MerkleTreeBaseEth`, …) and
  tags rows with the correct `chainId` + `asset`.

## Data model rationale

- **uint256 as `text`.** Commitments, roots, precommitments, and amounts are Poseidon/field
  values that overflow Postgres `numeric`/`bigint`. They're stored as decimal strings and parsed
  with `BigInt` on read.
- **`merkle_leaf` keyed by `${chainId}-${tree}-${index}`.** Deterministic and idempotent across
  reorgs; Ponder manages reorg rollback via its `_reorg__*` tables.
- **`vault_deposit` keyed by `${txHash}-${logIndex}`.** Unique per emitted event; looked up by
  `(chainId, precommitment)` for output-note resolution after vault-mode swaps.

## Read path in the frontend

1. `zkHandler.getOnChainLeaves()` calls `leafIndexClient.fetchIndexedLeaves(chainId, token)`.
2. That hits `GET {trade-executor}/vault-index/leaves?chainId&asset`.
3. On success, leaves feed the existing balance-reconciliation logic unchanged.
4. On failure (indexer down, network error), it returns `null` and `zkHandler` falls back to the
   original chunked `eth_getLogs` path — correctness preserved, performance degraded.

The same pattern applies to `resolveOutputNote()` → `fetchIndexedDeposit()` → `/vault-index/deposits`.

## Failure modes & guarantees

| Scenario | Behavior |
|---|---|
| Indexer container down | Frontend falls back to RPC scan (slow but correct) |
| Postgres down | trade-executor `/vault-index/*` returns 5xx → frontend RPC fallback |
| Backfill incomplete | `/leaves` returns partial set; balances may under-count until caught up |
| Chain reorg | Ponder rolls back affected rows automatically |
| Contract redeploy | Re-run `resolve-addresses`, restart indexer (fresh backfill for new addresses) |

## Scaling notes

- The indexer is I/O bound (RPC + Postgres), not CPU/memory heavy like the FHE engine. It can
  share the trade-executor host.
- Use a dedicated RPC provider (Alchemy/Infura) in production; public RPCs make backfill
  impractically slow.
- Ponder caches synced block ranges, so restarts resume rather than rescanning from scratch.
