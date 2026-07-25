# Graph / agent indexing handoff

Canonical write-up lives in the app repo (shared with MCP/Builder env):

**→ [siphon-app/docs/HANDOFF_GRAPH.md](../../siphon-app/docs/HANDOFF_GRAPH.md)**  
(adjust relative path if your checkout layout differs; sibling of this repo under `siphon_og/`)

**TL;DR**

- **Ponder stays.** It is still the dapp source of truth for merkle leaves + deposits.
- **`dev_lisbon` extended Ponder** with `Vault.Swapped` → `vault_swap`, plus `/anonymity-set` and `/swaps`.
- **`subgraph/`** is The Graph Studio package for agents — additive, not a replacement.
- Restart Ponder after pull; publish Studio for Graph-primary demos.
