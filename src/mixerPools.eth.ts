/**
 * Ethereum mainnet classic Tornado Cash pools for association indexing.
 * Addresses: publicly documented TC ETH pools (also in siphon-asp mixer seed).
 */
export type EthMixerPoolDef = {
  id: string;
  address: `0x${string}`;
  label: string;
  defaultStartBlock: number;
};

/** Classic fixed-denomination ETH pools (Deposit + Withdrawal events). */
export const ETH_TORNADO_POOLS: EthMixerPoolDef[] = [
  {
    id: "TornadoEth01",
    address: "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc",
    label: "tornado_0_1_eth",
    defaultStartBlock: 11_080_000,
  },
  {
    id: "TornadoEth1",
    address: "0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936",
    label: "tornado_1_eth",
    defaultStartBlock: 11_080_000,
  },
  {
    id: "TornadoEth10",
    address: "0x910Cbd523D972eb0a6f4CaE4618aD62622b39DbF",
    label: "tornado_10_eth",
    defaultStartBlock: 11_080_000,
  },
  {
    id: "TornadoEth100",
    address: "0xA160cdAB225685dA1d56aa342aD8841c3b53f291",
    label: "tornado_100_eth",
    defaultStartBlock: 11_080_000,
  },
];

export function ethMixerStartBlock(fallback: number): number {
  const v = process.env.ETH_MIXER_START_BLOCK?.trim();
  return v ? parseInt(v, 10) : fallback;
}

/** Default on when ETH RPC is present; set INDEX_ETH_TORNADO=0 to disable. */
export function indexEthTornado(): boolean {
  const v = (process.env.INDEX_ETH_TORNADO || "1").trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return Boolean(process.env.PONDER_RPC_URL_1?.trim());
}
