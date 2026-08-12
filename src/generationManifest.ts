import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * Checksum-pinned canonical vault-generation manifest.
 *
 * GENERATION_MANIFEST_PATH selects the manifest file and GENERATION_MANIFEST_SHA256 pins
 * its exact bytes. When configured, the manifest is the single source of truth for the
 * addresses this process may index; env values must agree with it. Any mismatch throws,
 * which aborts config load — the supervisor restarts loudly instead of indexing the
 * wrong contracts.
 */

export interface ManifestAsset {
  vault: string;
  tree: string;
}

export interface ManifestGeneration {
  generationId: string;
  chainId: number;
  lifecycle: string;
  entrypoint?: string;
  aspPostman?: string;
  assets?: Record<string, ManifestAsset>;
}

export interface GenerationManifest {
  manifestId?: string;
  generations: ManifestGeneration[];
}

type Env = Record<string, string | undefined>;

export function loadGenerationManifest(env: Env = process.env): GenerationManifest | null {
  const path = env.GENERATION_MANIFEST_PATH?.trim();
  if (!path) return null;
  const digest = env.GENERATION_MANIFEST_SHA256?.trim().toLowerCase();
  if (!digest) {
    throw new Error("GENERATION_MANIFEST_SHA256 must pin the generation manifest digest");
  }
  const raw = readFileSync(path);
  const actual = createHash("sha256").update(raw).digest("hex");
  if (actual !== digest) {
    throw new Error(`generation manifest digest mismatch: pinned ${digest}, file ${actual}`);
  }
  const data = JSON.parse(raw.toString("utf8")) as GenerationManifest;
  if (!Array.isArray(data.generations) || data.generations.length === 0) {
    throw new Error("generation manifest has no generations");
  }
  return data;
}

/**
 * Verify this indexer process's env-configured tree/vault addresses against the manifest
 * entry named by INDEXER_GENERATION_ID. Returns the generation (or null when no manifest
 * is configured).
 */
export function verifyIndexerBindings(env: Env = process.env): ManifestGeneration | null {
  const manifest = loadGenerationManifest(env);
  if (!manifest) return null;
  const generationId = env.INDEXER_GENERATION_ID?.trim();
  if (!generationId) {
    throw new Error("INDEXER_GENERATION_ID is required when GENERATION_MANIFEST_PATH is set");
  }
  const gen = manifest.generations.find((g) => g.generationId === generationId);
  if (!gen) {
    throw new Error(`generation ${generationId} is not present in the manifest`);
  }
  const prefix = gen.chainId === 8453 ? "BASE" : "SEPOLIA";
  for (const [asset, info] of Object.entries(gen.assets ?? {})) {
    for (const [envName, expected] of [
      [`MERKLE_TREE_${prefix}_${asset}`, info.tree],
      [`VAULT_${prefix}_${asset}`, info.vault],
    ] as const) {
      const actual = env[envName]?.trim().toLowerCase();
      if (actual !== expected.toLowerCase()) {
        throw new Error(
          `${envName}=${actual ?? "<unset>"} disagrees with manifest ${generationId} (${expected})`,
        );
      }
    }
  }
  return gen;
}
