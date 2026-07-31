/**
 * Base (8453) privacy-mixer pools for association indexing.
 * Official Tornado Cash is NOT on Base — Veil Cash is the primary Base privacy pool.
 * Addresses: https://docs.veil.cash/veil-cash-pools/deployments
 */

export type MixerPoolDef = {
  id: string;
  address: `0x${string}`;
  label: string;
  kind: "veil_entry" | "veil_nova" | "veil_classic";
  defaultStartBlock: number;
};

export const BASE_MIXER_POOLS: MixerPoolDef[] = [
  {
    id: "VeilEntry",
    address: "0xc2535c547B64b997A4BD9202E1663deaF11c78a5",
    label: "veil_entry",
    kind: "veil_entry",
    defaultStartBlock: 20_000_000,
  },
  {
    id: "VeilEthPool",
    address: "0x293dCda114533FF8f477271c5cA517209FFDEEe7",
    label: "veil_eth",
    kind: "veil_nova",
    defaultStartBlock: 20_000_000,
  },
  {
    id: "VeilUsdcPool",
    address: "0x5c50d58E49C59d112680c187De2Bf989d2a91242",
    label: "veil_usdc",
    kind: "veil_nova",
    defaultStartBlock: 20_000_000,
  },
  {
    id: "VeilLegacy01Eth",
    address: "0xd3560ef60dd06e27b699372c3da1b741c80b7d90",
    label: "veil_legacy_0_1_eth",
    kind: "veil_classic",
    defaultStartBlock: 15_000_000,
  },
];

export function mixerStartBlock(fallback: number): number {
  const v = process.env.BASE_MIXER_START_BLOCK?.trim();
  return v ? parseInt(v, 10) : fallback;
}

/** When false, skip mixer contract registration (Siphon trees/vaults only). Default: enabled. */
export function indexBaseMixers(): boolean {
  const v = (process.env.INDEX_BASE_MIXERS || "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}
