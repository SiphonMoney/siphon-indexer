import { createConfig } from "ponder";
import { MerkleTreeAbi } from "./abis/MerkleTree";
import { VaultAbi } from "./abis/Vault";

const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function opt(name: string): `0x${string}` | undefined {
  const v = process.env[name]?.trim();
  return v ? (v as `0x${string}`) : undefined;
}

function block(name: string, fallback: number): number {
  const v = process.env[name]?.trim();
  return v ? parseInt(v, 10) : fallback;
}

// MerkleTree + Vault addresses — run `npm run resolve-addresses` to populate .env
const baseEthTree = opt("MERKLE_TREE_BASE_ETH");
const baseUsdcTree = opt("MERKLE_TREE_BASE_USDC");
const sepoliaEthTree = opt("MERKLE_TREE_SEPOLIA_ETH");
const sepoliaUsdcTree = opt("MERKLE_TREE_SEPOLIA_USDC");

const baseEthVault = opt("VAULT_BASE_ETH");
const baseUsdcVault = opt("VAULT_BASE_USDC");
const sepoliaEthVault = opt("VAULT_SEPOLIA_ETH");
const sepoliaUsdcVault = opt("VAULT_SEPOLIA_USDC");

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: req("DATABASE_URL"),
  },
  chains: {
    base: {
      id: 8453,
      rpc: req("PONDER_RPC_URL_8453"),
    },
    ethSepolia: {
      id: 11155111,
      rpc: req("PONDER_RPC_URL_11155111"),
    },
  },
  contracts: {
    ...(baseEthTree
      ? {
          MerkleTreeBaseEth: {
            abi: MerkleTreeAbi,
            chain: "base",
            address: baseEthTree,
            startBlock: block("BASE_DEPLOY_BLOCK", 47_815_995),
          },
        }
      : {}),
    ...(baseUsdcTree
      ? {
          MerkleTreeBaseUsdc: {
            abi: MerkleTreeAbi,
            chain: "base",
            address: baseUsdcTree,
            startBlock: block("BASE_DEPLOY_BLOCK", 47_815_995),
          },
        }
      : {}),
    ...(sepoliaEthTree
      ? {
          MerkleTreeSepoliaEth: {
            abi: MerkleTreeAbi,
            chain: "ethSepolia",
            address: sepoliaEthTree,
            startBlock: block("SEPOLIA_DEPLOY_BLOCK", 11_130_700),
          },
        }
      : {}),
    ...(sepoliaUsdcTree
      ? {
          MerkleTreeSepoliaUsdc: {
            abi: MerkleTreeAbi,
            chain: "ethSepolia",
            address: sepoliaUsdcTree,
            startBlock: block("SEPOLIA_DEPLOY_BLOCK", 11_130_700),
          },
        }
      : {}),
    ...(baseEthVault
      ? {
          VaultBaseEth: {
            abi: VaultAbi,
            chain: "base",
            address: baseEthVault,
            startBlock: block("BASE_DEPLOY_BLOCK", 47_815_995),
          },
        }
      : {}),
    ...(baseUsdcVault
      ? {
          VaultBaseUsdc: {
            abi: VaultAbi,
            chain: "base",
            address: baseUsdcVault,
            startBlock: block("BASE_DEPLOY_BLOCK", 47_815_995),
          },
        }
      : {}),
    ...(sepoliaEthVault
      ? {
          VaultSepoliaEth: {
            abi: VaultAbi,
            chain: "ethSepolia",
            address: sepoliaEthVault,
            startBlock: block("SEPOLIA_DEPLOY_BLOCK", 11_130_700),
          },
        }
      : {}),
    ...(sepoliaUsdcVault
      ? {
          VaultSepoliaUsdc: {
            abi: VaultAbi,
            chain: "ethSepolia",
            address: sepoliaUsdcVault,
            startBlock: block("SEPOLIA_DEPLOY_BLOCK", 11_130_700),
          },
        }
      : {}),
  },
});

// Re-export for scripts
export const CHAIN_ASSET_MAP: Record<string, { chainId: number; asset: string }> = {
  MerkleTreeBaseEth: { chainId: 8453, asset: "ETH" },
  MerkleTreeBaseUsdc: { chainId: 8453, asset: "USDC" },
  MerkleTreeSepoliaEth: { chainId: 11155111, asset: "ETH" },
  MerkleTreeSepoliaUsdc: { chainId: 11155111, asset: "USDC" },
  VaultBaseEth: { chainId: 8453, asset: "ETH" },
  VaultBaseUsdc: { chainId: 8453, asset: "USDC" },
  VaultSepoliaEth: { chainId: 11155111, asset: "ETH" },
  VaultSepoliaUsdc: { chainId: 11155111, asset: "USDC" },
};

export const NATIVE_TOKEN = NATIVE;
