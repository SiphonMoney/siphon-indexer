import { ponder, type Context } from "ponder:registry";
import schema from "ponder:schema";
import {
  includesBase,
  includesSepolia,
  parseIndexerScope,
} from "./indexerScope";

type DepositEvent = {
  args: {
    depositor: `0x${string}`;
    amount: bigint;
    commitment: bigint;
    precommitment: bigint;
    label: bigint;
    nonce: bigint;
  };
  log: { address: `0x${string}`; logIndex: number };
  block: { number: bigint; timestamp: bigint };
  transaction: { hash: `0x${string}` };
};

type SwapEvent = {
  args: {
    recipient: `0x${string}`;
    _param: {
      pool: `0x${string}`;
      srcToken: `0x${string}`;
      dstToken: `0x${string}`;
      recipient: `0x${string}`;
      amountIn: bigint;
      minAmountOut: bigint;
      fee: number;
      deadline: bigint;
    };
    _spentNullifier: bigint;
    _newCommitment: bigint;
    _newLabel: bigint;
  };
  log: { address: `0x${string}`; logIndex: number };
  block: { number: bigint; timestamp: bigint };
  transaction: { hash: `0x${string}` };
};

async function insertDeposit(
  event: DepositEvent,
  context: Context,
  chainId: number,
  asset: string,
) {
  const { depositor, amount, commitment, precommitment, label, nonce } = event.args;
  const id = `${event.transaction.hash}-${event.log.logIndex}`;

  await context.db
    .insert(schema.vaultDeposit)
    .values({
      id,
      chainId,
      asset,
      vault: event.log.address,
      depositor,
      amount: amount.toString(),
      commitment: commitment.toString(),
      precommitment: precommitment.toString(),
      label: label.toString(),
      nonce: nonce.toString(),
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
    })
    .onConflictDoNothing();
}

async function insertSwap(
  event: SwapEvent,
  context: Context,
  chainId: number,
  asset: string,
) {
  const { recipient, _param, _spentNullifier, _newCommitment, _newLabel } = event.args;
  const id = `${event.transaction.hash}-${event.log.logIndex}`;

  await context.db
    .insert(schema.vaultSwap)
    .values({
      id,
      chainId,
      asset,
      vault: event.log.address,
      recipient,
      pool: _param.pool,
      srcToken: _param.srcToken,
      dstToken: _param.dstToken,
      amountIn: _param.amountIn.toString(),
      minAmountOut: _param.minAmountOut.toString(),
      fee: _param.fee.toString(),
      spentNullifier: _spentNullifier.toString(),
      newCommitment: _newCommitment.toString(),
      newLabel: _newLabel.toString(),
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
    })
    .onConflictDoNothing();
}

const indexerScope = parseIndexerScope(process.env.INDEXER_SCOPE);

if (includesBase(indexerScope)) {
  ponder.on("VaultBaseEth:Deposited", async ({ event, context }) => {
    await insertDeposit(event, context, 8453, "ETH");
  });
  ponder.on("VaultBaseUsdc:Deposited", async ({ event, context }) => {
    await insertDeposit(event, context, 8453, "USDC");
  });

  ponder.on("VaultBaseEth:Swapped", async ({ event, context }) => {
    await insertSwap(event, context, 8453, "ETH");
  });
  ponder.on("VaultBaseUsdc:Swapped", async ({ event, context }) => {
    await insertSwap(event, context, 8453, "USDC");
  });
}

if (includesSepolia(indexerScope)) {
  ponder.on("VaultSepoliaEth:Deposited", async ({ event, context }) => {
    await insertDeposit(event, context, 11155111, "ETH");
  });
  ponder.on("VaultSepoliaUsdc:Deposited", async ({ event, context }) => {
    await insertDeposit(event, context, 11155111, "USDC");
  });

  ponder.on("VaultSepoliaEth:Swapped", async ({ event, context }) => {
    await insertSwap(event, context, 11155111, "ETH");
  });
  ponder.on("VaultSepoliaUsdc:Swapped", async ({ event, context }) => {
    await insertSwap(event, context, 11155111, "USDC");
  });
}
