import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Deposited, Swapped } from "../generated/VaultBaseEth/Vault";
import { AnonymitySet, Deposit, Vault, VaultSwap } from "../generated/schema";

function ensureVault(id: string, chainId: i32, asset: string, address: Address): Vault {
  let vault = Vault.load(id);
  if (vault == null) {
    vault = new Vault(id);
    vault.chainId = chainId;
    vault.asset = asset;
    vault.address = address;
    vault.save();
  }
  return vault as Vault;
}

function loadOrInitSet(chainId: i32, asset: string): AnonymitySet {
  let id = chainId.toString() + "-" + asset;
  let set = AnonymitySet.load(id);
  if (set == null) {
    set = new AnonymitySet(id);
    set.chainId = chainId;
    set.asset = asset;
    set.leafCount = BigInt.fromI32(0);
    set.depositCount = BigInt.fromI32(0);
    set.swapCount = BigInt.fromI32(0);
  }
  return set as AnonymitySet;
}

function handleDeposit(event: Deposited, chainId: i32, asset: string): void {
  let vaultId = chainId.toString() + "-" + asset + "-" + event.address.toHexString();
  let vault = ensureVault(vaultId, chainId, asset, event.address);

  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();

  let deposit = new Deposit(id);
  deposit.chainId = chainId;
  deposit.asset = asset;
  deposit.vault = vault.id;
  deposit.depositor = event.params.depositor;
  deposit.amount = event.params.amount;
  deposit.commitment = event.params.commitment;
  deposit.precommitment = event.params.precommitment;
  deposit.blockNumber = event.block.number;
  deposit.blockTimestamp = event.block.timestamp;
  deposit.txHash = event.transaction.hash;
  deposit.save();

  let set = loadOrInitSet(chainId, asset);
  set.depositCount = set.depositCount.plus(BigInt.fromI32(1));
  set.lastDepositAt = event.block.timestamp;
  set.save();
}

function handleSwap(event: Swapped, chainId: i32, asset: string): void {
  let vaultId = chainId.toString() + "-" + asset + "-" + event.address.toHexString();
  let vault = ensureVault(vaultId, chainId, asset, event.address);

  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let param = event.params._param;

  let swap = new VaultSwap(id);
  swap.chainId = chainId;
  swap.asset = asset;
  swap.vault = vault.id;
  swap.recipient = event.params.recipient;
  swap.pool = param.pool;
  swap.srcToken = param.srcToken;
  swap.dstToken = param.dstToken;
  swap.amountIn = param.amountIn;
  swap.minAmountOut = param.minAmountOut;
  swap.fee = BigInt.fromI32(param.fee);
  swap.spentNullifier = event.params._spentNullifier;
  swap.newCommitment = event.params._newCommitment;
  swap.blockNumber = event.block.number;
  swap.blockTimestamp = event.block.timestamp;
  swap.txHash = event.transaction.hash;
  swap.save();

  let set = loadOrInitSet(chainId, asset);
  set.swapCount = set.swapCount.plus(BigInt.fromI32(1));
  set.lastSwapAt = event.block.timestamp;
  set.save();
}

export function handleDepositedBaseEth(event: Deposited): void {
  handleDeposit(event, 8453, "ETH");
}
export function handleDepositedBaseUsdc(event: Deposited): void {
  handleDeposit(event, 8453, "USDC");
}
export function handleSwappedBaseEth(event: Swapped): void {
  handleSwap(event, 8453, "ETH");
}
export function handleSwappedBaseUsdc(event: Swapped): void {
  handleSwap(event, 8453, "USDC");
}
