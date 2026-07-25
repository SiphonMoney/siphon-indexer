/**
 * Ponder + subgraph ABI stay in lockstep with IVault / IMerkleTree (structural).
 * Topic0 equality vs Solidity is covered in siphon-app packages/sdk-ts
 * tests/graph.contract-events.test.ts (ethers).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const vaultAbi = JSON.parse(
  readFileSync(join(root, "subgraph", "abis", "Vault.json"), "utf8"),
) as Array<{
  type?: string;
  name?: string;
  inputs?: Array<{ name: string; type: string; indexed?: boolean; components?: unknown[] }>;
}>;
const merkleAbi = JSON.parse(
  readFileSync(join(root, "subgraph", "abis", "MerkleTree.json"), "utf8"),
) as Array<{ type?: string; name?: string; inputs?: unknown[] }>;

describe("subgraph ABIs", () => {
  it("include Deposited with indexed depositor", () => {
    const ev = vaultAbi.find((e) => e.name === "Deposited");
    assert.ok(ev);
    assert.equal(ev!.type, "event");
    assert.equal(ev!.inputs![0].name, "depositor");
    assert.equal(ev!.inputs![0].indexed, true);
    assert.equal(ev!.inputs!.length, 4);
  });

  it("include Swapped with 8-field SwapParam tuple", () => {
    const ev = vaultAbi.find((e) => e.name === "Swapped");
    assert.ok(ev);
    const param = ev!.inputs!.find((i) => i.name === "_param");
    assert.ok(param);
    assert.equal(param!.type, "tuple");
    assert.equal(param!.components!.length, 8);
    const names = (param!.components as Array<{ name: string }>).map((c) => c.name);
    assert.deepEqual(names, [
      "pool",
      "srcToken",
      "dstToken",
      "recipient",
      "amountIn",
      "minAmountOut",
      "fee",
      "deadline",
    ]);
  });

  it("include LeafInserted", () => {
    const ev = merkleAbi.find((e) => e.name === "LeafInserted");
    assert.ok(ev);
    assert.equal(ev!.inputs!.length, 3);
  });
});

describe("ponder handlers wire Swapped", () => {
  it("src/Vault.ts listens for Swapped on all vaults", () => {
    const src = readFileSync(join(root, "src", "Vault.ts"), "utf8");
    for (const name of [
      "VaultBaseEth:Swapped",
      "VaultBaseUsdc:Swapped",
      "VaultSepoliaEth:Swapped",
      "VaultSepoliaUsdc:Swapped",
    ]) {
      assert.ok(src.includes(name), `missing ${name}`);
    }
  });

  it("API exposes anonymity-set and swaps for Graph client fallback", () => {
    const api = readFileSync(join(root, "src", "api", "index.ts"), "utf8");
    assert.ok(api.includes("/anonymity-set"));
    assert.ok(api.includes("/swaps"));
  });
});
