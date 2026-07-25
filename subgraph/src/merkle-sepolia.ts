import { Address, BigInt } from "@graphprotocol/graph-ts";
import { LeafInserted } from "../generated/MerkleTreeSepoliaEth/MerkleTree";
import { AnonymitySet, MerkleLeaf, MerkleTree } from "../generated/schema";

function ensureTree(id: string, chainId: i32, asset: string, address: Address): MerkleTree {
  let tree = MerkleTree.load(id);
  if (tree == null) {
    tree = new MerkleTree(id);
    tree.chainId = chainId;
    tree.asset = asset;
    tree.address = address;
    tree.save();
  }
  return tree as MerkleTree;
}

function bumpLeafCount(chainId: i32, asset: string, timestamp: BigInt): void {
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
  set.leafCount = set.leafCount.plus(BigInt.fromI32(1));
  set.lastLeafAt = timestamp;
  set.save();
}

function handleLeaf(event: LeafInserted, chainId: i32, asset: string): void {
  let treeId = chainId.toString() + "-" + asset + "-" + event.address.toHexString();
  let tree = ensureTree(treeId, chainId, asset, event.address);

  let leafId =
    chainId.toString() +
    "-" +
    event.address.toHexString() +
    "-" +
    event.params._index.toString();

  let leaf = new MerkleLeaf(leafId);
  leaf.chainId = chainId;
  leaf.asset = asset;
  leaf.merkleTree = tree.id;
  leaf.leafIndex = event.params._index;
  leaf.leaf = event.params._leaf;
  leaf.root = event.params._root;
  leaf.blockNumber = event.block.number;
  leaf.blockTimestamp = event.block.timestamp;
  leaf.txHash = event.transaction.hash;
  leaf.save();

  bumpLeafCount(chainId, asset, event.block.timestamp);
}

export function handleLeafInsertedSepoliaEth(event: LeafInserted): void {
  handleLeaf(event, 11155111, "ETH");
}

export function handleLeafInsertedSepoliaUsdc(event: LeafInserted): void {
  handleLeaf(event, 11155111, "USDC");
}
