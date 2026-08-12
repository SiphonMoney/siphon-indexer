import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadGenerationManifest, verifyIndexerBindings } from "../src/generationManifest";

const MANIFEST = {
  schemaVersion: 1,
  manifestId: "test",
  generations: [
    {
      generationId: "sepolia-hard-asp-v1-20260806",
      chainId: 11155111,
      lifecycle: "ACTIVE",
      entrypoint: "0xB45Ac5aBBa8d282f2F8A2D55CBd13711230Ae0e0",
      assets: {
        ETH: { vault: "0x6e0c4A1f7adAf0f80a4881a2635C0AFfE998fBDe", tree: "0x2a9C7e0603611062C872FA58083Da4394aa8623a" },
        USDC: { vault: "0x50A3bc1Cd443fe5bd0A9FbF04FF655E4b54Deb3b", tree: "0xE895a7ECbF7Ea9fb856CE685145B1C8fc97bBd28" },
      },
    },
  ],
};

function install(data: unknown = MANIFEST, digest?: string) {
  const raw = JSON.stringify(data);
  const dir = mkdtempSync(join(tmpdir(), "gen-manifest-"));
  const path = join(dir, "generation-manifest.json");
  writeFileSync(path, raw);
  return {
    GENERATION_MANIFEST_PATH: path,
    GENERATION_MANIFEST_SHA256: digest ?? createHash("sha256").update(raw).digest("hex"),
  };
}

const GOOD_ENV = {
  INDEXER_GENERATION_ID: "sepolia-hard-asp-v1-20260806",
  MERKLE_TREE_SEPOLIA_ETH: "0x2a9C7e0603611062C872FA58083Da4394aa8623a",
  MERKLE_TREE_SEPOLIA_USDC: "0xE895a7ECbF7Ea9fb856CE685145B1C8fc97bBd28",
  VAULT_SEPOLIA_ETH: "0x6e0c4A1f7adAf0f80a4881a2635C0AFfE998fBDe",
  VAULT_SEPOLIA_USDC: "0x50A3bc1Cd443fe5bd0A9FbF04FF655E4b54Deb3b",
};

describe("loadGenerationManifest", () => {
  test("returns null when unconfigured", () => {
    expect(loadGenerationManifest({})).toBeNull();
  });

  test("requires a pinned digest", () => {
    const env = install();
    expect(() =>
      loadGenerationManifest({ GENERATION_MANIFEST_PATH: env.GENERATION_MANIFEST_PATH }),
    ).toThrow(/SHA256/);
  });

  test("rejects a digest mismatch", () => {
    const env = install(MANIFEST, "0".repeat(64));
    expect(() => loadGenerationManifest(env)).toThrow(/digest mismatch/);
  });

  test("loads a pinned manifest", () => {
    const manifest = loadGenerationManifest(install());
    expect(manifest?.generations).toHaveLength(1);
  });
});

describe("verifyIndexerBindings", () => {
  test("passes when env matches the manifest", () => {
    const gen = verifyIndexerBindings({ ...install(), ...GOOD_ENV });
    expect(gen?.generationId).toBe("sepolia-hard-asp-v1-20260806");
  });

  test("is a no-op without a configured manifest", () => {
    expect(verifyIndexerBindings({ ...GOOD_ENV })).toBeNull();
  });

  test("requires INDEXER_GENERATION_ID when a manifest is pinned", () => {
    expect(() => verifyIndexerBindings({ ...install() })).toThrow(/INDEXER_GENERATION_ID/);
  });

  test("rejects a generation missing from the manifest", () => {
    expect(() =>
      verifyIndexerBindings({ ...install(), ...GOOD_ENV, INDEXER_GENERATION_ID: "nope" }),
    ).toThrow(/not present/);
  });

  test("rejects tree address drift", () => {
    expect(() =>
      verifyIndexerBindings({
        ...install(),
        ...GOOD_ENV,
        MERKLE_TREE_SEPOLIA_ETH: "0x" + "ab".repeat(20),
      }),
    ).toThrow(/MERKLE_TREE_SEPOLIA_ETH/);
  });

  test("rejects vault address drift", () => {
    expect(() =>
      verifyIndexerBindings({
        ...install(),
        ...GOOD_ENV,
        VAULT_SEPOLIA_USDC: "0x" + "cd".repeat(20),
      }),
    ).toThrow(/VAULT_SEPOLIA_USDC/);
  });
});
