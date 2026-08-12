import { describe, expect, test } from "bun:test";
import { assessFreshness, healthTargetsForScope } from "../scripts/indexer-health.mjs";

describe("chain indexer health", () => {
  test("requires each configured asset to be contiguous and caught up", () => {
    const root = "123456";
    expect(assessFreshness({ totalCount: 57, contiguous: true, tipRoot: root }, 57, root)).toEqual({ ok: true });
    expect(assessFreshness({ totalCount: 56, contiguous: true, tipRoot: root }, 57, root)).toEqual({
      ok: false,
      reason: "indexed 56 of 57 leaves",
    });
    expect(assessFreshness({ totalCount: 57, contiguous: false, tipRoot: root }, 57, root)).toEqual({
      ok: false,
      reason: "indexed leaves are not contiguous",
    });
    expect(assessFreshness({ totalCount: 57, contiguous: true, tipRoot: "999" }, 57, root)).toEqual({
      ok: false,
      reason: "indexed tip root does not match chain",
    });
  });

  test("health probes only the isolated process chain", () => {
    const env = {
      MERKLE_TREE_BASE_ETH: "0x0000000000000000000000000000000000000001",
      MERKLE_TREE_BASE_USDC: "0x0000000000000000000000000000000000000002",
      MERKLE_TREE_SEPOLIA_ETH: "0x0000000000000000000000000000000000000003",
      MERKLE_TREE_SEPOLIA_USDC: "0x0000000000000000000000000000000000000004",
    };
    expect(healthTargetsForScope("base", env).map((t) => t.chainId)).toEqual([8453, 8453]);
    expect(healthTargetsForScope("sepolia", env).map((t) => t.chainId)).toEqual([
      11155111,
      11155111,
    ]);
  });
});
