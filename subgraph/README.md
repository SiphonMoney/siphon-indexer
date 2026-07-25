# Siphon vault subgraph (The Graph)

Indexes Siphon **MerkleTree** `LeafInserted`, **Vault** `Deposited` + `Swapped` on Base (primary) and Sepolia (optional). Agents use this for:

- anonymity-set size (`AnonymitySet.leafCount`)
- recent vault settles (`VaultSwap`)
- deposit counters

Uniswap V3 liquidity is **not** indexed here — the app/MCP query the public Uniswap V3 Base subgraph on The Graph Network.

## Deploy (Studio)

```bash
cd siphon-subgraph
npm install
npm run codegen && npm run build
# auth once: graph auth --studio <DEPLOY_KEY>
npm run deploy:studio
```

Sepolia:

```bash
npm run codegen:sepolia && npm run build:sepolia
npm run deploy:studio:sepolia
```

After publish, set in app / MCP env:

```
THE_GRAPH_API_KEY=...
SIPHON_SUBGRAPH_ID=<deployment id from Studio>
# or full URL:
# SIPHON_SUBGRAPH_URL=https://gateway.thegraph.com/api/<KEY>/subgraphs/id/<ID>
```

## Addresses

Match `siphon-indexer/.env.example` (Base ETH/USDC vaults + merkle trees). Update `subgraph.yaml` if you redeploy contracts.

## Local Graph Node

```bash
npm run create:local
npm run deploy:local
```
