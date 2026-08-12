import { describe, expect, test } from "bun:test";
import {
  chainIdForScope,
  rpcReady,
  rpcUrlsForScope,
  runSupervisor,
} from "../scripts/indexer-supervisor.mjs";

describe("indexer supervisor", () => {
  test("preflights only the RPC owned by the isolated process", () => {
    const env = {
      PONDER_RPC_URL_8453: "https://base.example",
      PONDER_RPC_URL_11155111: "https://sepolia.example",
    };
    expect(rpcUrlsForScope("base", env)).toEqual(["https://base.example"]);
    expect(rpcUrlsForScope("sepolia", env)).toEqual(["https://sepolia.example"]);
    expect(chainIdForScope("base")).toBe(8453);
    expect(chainIdForScope("sepolia")).toBe(11155111);
  });

  test("rejects a reachable RPC for the wrong chain", async () => {
    const baseResponse = async () =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x2105" }), {
        status: 200,
      });

    expect(await rpcReady("https://rpc.example", 8453, baseResponse)).toBe(true);
    expect(await rpcReady("https://rpc.example", 11155111, baseResponse)).toBe(false);
  });

  test("waits for RPC recovery instead of starting a doomed Ponder child", async () => {
    const abort = new AbortController();
    const readiness = [false, false, true];
    let starts = 0;

    await runSupervisor({
      scope: "base",
      urls: ["https://base.example"],
      signal: abort.signal,
      checkRpc: async () => readiness.shift() ?? true,
      runPonder: async () => {
        starts += 1;
        abort.abort();
        return 1;
      },
      sleep: async () => {},
      log: () => {},
    });

    expect(starts).toBe(1);
  });

  test("keeps the container supervisor alive after Ponder exits", async () => {
    const abort = new AbortController();
    let starts = 0;

    await runSupervisor({
      scope: "base",
      urls: ["https://base.example"],
      signal: abort.signal,
      checkRpc: async () => true,
      runPonder: async () => {
        starts += 1;
        if (starts === 2) abort.abort();
        return 1;
      },
      sleep: async () => {},
      log: () => {},
    });

    expect(starts).toBe(2);
  });
});
