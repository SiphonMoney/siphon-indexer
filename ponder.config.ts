import { createConfig } from "ponder";
import { MerkleTreeAbi } from "./abis/MerkleTree";
import { VaultAbi } from "./abis/Vault";

const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function reqAddress(name: string): `0x${string}` {
  return req(name) as `0x${string}`;
}

function block(name: string, fallback: number): number {
  const v = process.env[name]?.trim();
  return v ? parseInt(v, 10) : fallback;
}

// MerkleTree + Vault addresses — run `npm run resolve-addresses` to populate .env.local
const baseDeployBlock = block("BASE_DEPLOY_BLOCK", 47_815_995);
const sepoliaDeployBlock = block("SEPOLIA_DEPLOY_BLOCK", 11_130_700);

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
    MerkleTreeBaseEth: {
      abi: MerkleTreeAbi,
      chain: "base",
      address: reqAddress("MERKLE_TREE_BASE_ETH"),
      startBlock: baseDeployBlock,
    },
    MerkleTreeBaseUsdc: {
      abi: MerkleTreeAbi,
      chain: "base",
      address: reqAddress("MERKLE_TREE_BASE_USDC"),
      startBlock: baseDeployBlock,
    },
    MerkleTreeSepoliaEth: {
      abi: MerkleTreeAbi,
      chain: "ethSepolia",
      address: reqAddress("MERKLE_TREE_SEPOLIA_ETH"),
      startBlock: sepoliaDeployBlock,
    },
    MerkleTreeSepoliaUsdc: {
      abi: MerkleTreeAbi,
      chain: "ethSepolia",
      address: reqAddress("MERKLE_TREE_SEPOLIA_USDC"),
      startBlock: sepoliaDeployBlock,
    },
    VaultBaseEth: {
      abi: VaultAbi,
      chain: "base",
      address: reqAddress("VAULT_BASE_ETH"),
      startBlock: baseDeployBlock,
    },
    VaultBaseUsdc: {
      abi: VaultAbi,
      chain: "base",
      address: reqAddress("VAULT_BASE_USDC"),
      startBlock: baseDeployBlock,
    },
    VaultSepoliaEth: {
      abi: VaultAbi,
      chain: "ethSepolia",
      address: reqAddress("VAULT_SEPOLIA_ETH"),
      startBlock: sepoliaDeployBlock,
    },
    VaultSepoliaUsdc: {
      abi: VaultAbi,
      chain: "ethSepolia",
      address: reqAddress("VAULT_SEPOLIA_USDC"),
      startBlock: sepoliaDeployBlock,
    },
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
