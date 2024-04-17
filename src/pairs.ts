import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { PairCreated } from "../generated/PairFactoryUpgradeable/PairFactory";
import { Pair as ThePair } from "../generated/PairFactoryUpgradeable/Pair";

import {
  Pair,
  PathToTarget,
  TokenData,
  TokenToPair,
} from "../generated/schema";

const WBNB = Address.fromString("0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c");

const USDC = Address.fromString("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d");

const BUSD = Address.fromString("0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56");

const HEY = Address.fromString("0x0782b6d8c4551B9760e74c0545a9bCD90bdc41E5");

const FRAX = Address.fromString("0x90C97F71E18723b0Cf0dfa30ee176Ab653E89F40");

const TOKEN_DATA_ID = "TOKEN_DATA";

const targets = [WBNB, USDC, BUSD, HEY, FRAX];

function addEdge(token: Address, pair: Pair): void {
  let tokenToPair = TokenToPair.load(token.toHex());
  if (!tokenToPair) {
    tokenToPair = new TokenToPair(token.toHex());
    tokenToPair.pairs = [];
  }
  const pairs = tokenToPair.pairs;
  pairs.push(pair.id);
  tokenToPair.pairs = pairs;
  tokenToPair.save();
}

function addToken(token: Address): void {
  // adds the token to TokenData scheme if not exists
  let tokenData = TokenData.load(TOKEN_DATA_ID);
  if (!tokenData) {
    tokenData = new TokenData(TOKEN_DATA_ID);
    tokenData.tokens = [];
  }

  const tokens = tokenData.tokens;

  if (!tokens.includes(token)) {
    tokens.push(token);
  }

  tokenData.tokens = tokens;
  tokenData.save();
}

function getTokens(): Address[] {
  let tokenData = TokenData.load(TOKEN_DATA_ID);
  if (!tokenData) {
    tokenData = new TokenData(TOKEN_DATA_ID);
    tokenData.tokens = [];
  }
  return tokenData.tokens.map<Address>((bytesAddress) =>
    Address.fromBytes(bytesAddress)
  );
}

function getPairs(token: Address): Pair[] {
  let tokenToPair = TokenToPair.load(token.toHex());
  if (!tokenToPair) {
    return [];
  } else {
    return tokenToPair.pairs
      .map<Pair>((strPairAddress) => Pair.load(strPairAddress)!)
      .filter(
        (pair): bool => {
          const thePair = ThePair.bind(Address.fromString(pair.id));
          const reserves = thePair.getReserves();

          return !(
            // low liquidity
            (
              reserves.value0.lt(BigInt.fromI64(10000000000)) ||
              reserves.value1.lt(BigInt.fromI64(10000000000))
            )
          );
        }
      );
  }
}

function savePathToTarget(
  token: Address,
  target: Address,
  path: Address[]
): void {
  const id = token.toHex() + "-" + target.toHex();
  let pathToTarget = PathToTarget.load(id);
  if (!pathToTarget) {
    pathToTarget = new PathToTarget(id);
    pathToTarget.token = token;
    pathToTarget.target = target;
    pathToTarget.path = [];
  }

  pathToTarget.path = changetype<Bytes[]>(path);
  pathToTarget.save();
}

class IncomingPair {
  public parent: IncomingPair | null;
  public token: Address;
  public pair: Pair;

  constructor(parent_: IncomingPair | null, token_: Address, pair_: Pair) {
    this.parent = parent_;
    this.token = token_;
    this.pair = pair_;
  }
}

function PairsToIncomingPairs(
  parent: IncomingPair | null,
  token: Address,
  pairs: Pair[]
): IncomingPair[] {
  const _pairs: IncomingPair[] = [];
  for (let i = 0; i < pairs.length; i++) {
    _pairs.push(new IncomingPair(parent, token, pairs[i]));
  }
  return _pairs;
}

function calculatePathToTarget(token: Address, target: Address): void {
  let visited: Map<string, bool> = new Map<string, bool>();

  if (token == target) {
    savePathToTarget(token, target, [target]);
    return;
  }

  let fringe: Array<IncomingPair>;
  fringe = PairsToIncomingPairs(null, token, getPairs(token));

  while (fringe.length > 0) {
    const top = fringe.shift();
    const _token = top.token;
    const _pair = top.pair;

    visited.set(_pair.id, true);

    const otherToken = _pair.token0 == _token ? _pair.token1 : _pair.token0;

    if (otherToken == target) {
      const path: Address[] = [];
      let __parent: IncomingPair | null = top;
      while (__parent != null) {
        path.push(Address.fromString(__parent.pair.id));
        __parent = __parent.parent;
      }
      savePathToTarget(token, target, path.reverse());
      return;
    }

    // continue the search from otherToken
    const otherTokenPairs = getPairs(Address.fromBytes(otherToken));
    for (let i = 0; i < otherTokenPairs.length; i++) {
      if (!visited.has(otherTokenPairs[i].id)) {
        fringe.push(
          new IncomingPair(
            top,
            Address.fromBytes(otherToken),
            otherTokenPairs[i]
          )
        );
      }
    }
  }
}

export function handlePairCreated(event: PairCreated): void {
  // get the pair address
  const pairAddress = event.params.pair;
  // get the token0 address
  const token0Address = event.params.token0;
  // get the token1 address
  const token1Address = event.params.token1;

  // create an edge and add it to the tree
  // the edge will be from token0 to token1 and the pair address will be the edge id
  const pair = new Pair(pairAddress.toHex());
  pair.token0 = token0Address;
  pair.token1 = token1Address;
  pair.stable = event.params.stable;
  pair.save();

  // adjacency list
  addEdge(token0Address, pair);
  addEdge(token1Address, pair);

  addToken(token0Address);
  addToken(token1Address);

  const tokens = getTokens();

  tokens.forEach((token) => {
    calculatePathToTarget(token, WBNB);
  });
}
