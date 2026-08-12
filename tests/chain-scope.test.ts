import { describe, expect, test } from "bun:test";
import { deploymentTopology, parseIndexerScope } from "../src/indexerScope";

describe("chain-isolated indexer topology", () => {
  test("base scope cannot load Sepolia or Ethereum RPCs", () => {
    expect(deploymentTopology("base")).toEqual({
      scope: "base",
      chains: ["base"],
      vaultContracts: [
        "MerkleTreeBaseEth",
        "MerkleTreeBaseUsdc",
        "VaultBaseEth",
        "VaultBaseUsdc",
      ],
    });
  });

  test("sepolia scope cannot load Base RPCs or contracts", () => {
    expect(deploymentTopology("sepolia")).toEqual({
      scope: "sepolia",
      chains: ["ethSepolia"],
      vaultContracts: [
        "MerkleTreeSepoliaEth",
        "MerkleTreeSepoliaUsdc",
        "VaultSepoliaEth",
        "VaultSepoliaUsdc",
      ],
    });
  });

  test("invalid production scope fails before Ponder starts", () => {
    expect(() => parseIndexerScope("polygon")).toThrow("INDEXER_SCOPE");
  });
});
