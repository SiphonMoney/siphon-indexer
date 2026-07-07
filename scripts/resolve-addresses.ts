/**
 * Resolve vault + merkleTree addresses from each chain's Entrypoint.
 * Writes MERKLE_TREE_* and VAULT_* lines to stdout (pipe to .env).
 *
 * Usage:
 *   npm run resolve-addresses
 *   npm run resolve-addresses >> .env
 */
import { createPublicClient, http, parseAbi } from "viem";
import { base, sepolia } from "viem/chains";

const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

const entrypointAbi = parseAbi([
  "function getVault(address asset) view returns (address)",
]);

const vaultAbi = parseAbi([
  "function merkleTree() view returns (address)",
]);

const CHAINS = [
  {
    label: "BASE",
    chain: base,
    rpc: process.env.PONDER_RPC_URL_8453 || "https://mainnet.base.org",
    entrypoint: (process.env.ENTRYPOINT_BASE ||
      "0x2f7d237977A86830708D9C872f5F4D3D7A980138") as `0x${string}`,
    usdc: (process.env.USDC_BASE ||
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as `0x${string}`,
    prefix: "BASE",
  },
  {
    label: "SEPOLIA",
    chain: sepolia,
    rpc: process.env.PONDER_RPC_URL_11155111 || "https://ethereum-sepolia-rpc.publicnode.com",
    entrypoint: (process.env.ENTRYPOINT_SEPOLIA ||
      "0x867e9C195eB85960c390D4a7A64F4e16905D6638") as `0x${string}`,
    usdc: (process.env.USDC_SEPOLIA ||
      "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238") as `0x${string}`,
    prefix: "SEPOLIA",
  },
] as const;

async function resolveVault(
  client: ReturnType<typeof createPublicClient>,
  entrypoint: `0x${string}`,
  asset: `0x${string}`,
) {
  const vault = await client.readContract({
    address: entrypoint,
    abi: entrypointAbi,
    functionName: "getVault",
    args: [asset],
  });
  const merkleTree = await client.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "merkleTree",
  });
  return { vault, merkleTree };
}

async function main() {
  const lines: string[] = [];

  for (const cfg of CHAINS) {
    const client = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpc) });

    for (const [assetLabel, token] of [
      ["ETH", NATIVE],
      ["USDC", cfg.usdc],
    ] as const) {
      const { vault, merkleTree } = await resolveVault(client, cfg.entrypoint, token);
      const envPrefix = cfg.prefix === "BASE" ? "BASE" : "SEPOLIA";
      lines.push(`VAULT_${envPrefix}_${assetLabel}=${vault}`);
      lines.push(`MERKLE_TREE_${envPrefix}_${assetLabel}=${merkleTree}`);
      console.error(`[${cfg.label}] ${assetLabel} vault=${vault} merkleTree=${merkleTree}`);
    }
  }

  console.log(lines.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
