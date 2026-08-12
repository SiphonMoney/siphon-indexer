export type IndexerScope = "all" | "base" | "sepolia";

const BASE_VAULT_CONTRACTS = [
  "MerkleTreeBaseEth",
  "MerkleTreeBaseUsdc",
  "VaultBaseEth",
  "VaultBaseUsdc",
] as const;

const SEPOLIA_VAULT_CONTRACTS = [
  "MerkleTreeSepoliaEth",
  "MerkleTreeSepoliaUsdc",
  "VaultSepoliaEth",
  "VaultSepoliaUsdc",
] as const;

export function parseIndexerScope(value: string | undefined): IndexerScope {
  const scope = (value || "all").trim().toLowerCase();
  if (scope === "all" || scope === "base" || scope === "sepolia") return scope;
  throw new Error(`Invalid INDEXER_SCOPE=${value}; expected all, base, or sepolia`);
}

export function deploymentTopology(value: string | undefined) {
  const scope = parseIndexerScope(value);
  return {
    scope,
    chains:
      scope === "base"
        ? (["base"] as const)
        : scope === "sepolia"
          ? (["ethSepolia"] as const)
          : (["base", "ethSepolia"] as const),
    vaultContracts:
      scope === "base"
        ? BASE_VAULT_CONTRACTS
        : scope === "sepolia"
          ? SEPOLIA_VAULT_CONTRACTS
          : [...BASE_VAULT_CONTRACTS, ...SEPOLIA_VAULT_CONTRACTS],
  };
}

export function includesBase(scope: IndexerScope): boolean {
  return scope === "all" || scope === "base";
}

export function includesSepolia(scope: IndexerScope): boolean {
  return scope === "all" || scope === "sepolia";
}
