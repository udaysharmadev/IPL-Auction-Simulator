import { AUCTION_CATEGORY_ORDER, categoryRank } from "@/data/auction/categoryOrder";
import type { AuctionCategory, Player } from "@/data/players/types";
import { createNamedRng, type SeededRng } from "@/engine/random/seededRng";

export type AuctionOrderEntry = {
  playerId: string;
  category: AuctionCategory;
  categoryIndex: number;
  position: number;
};

/**
 * Legacy player fixtures predate explicit categories. Keep a deterministic
 * inference here so old saves and tests remain replayable during migration.
 */
export function categoryForPlayer(player: Player): AuctionCategory { return player.auctionData.category; }

function shuffle<T>(items: readonly T[], rng: SeededRng): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.int(0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/** Generates category-grouped order with seeded, stable order within groups. */
export function generateAuctionOrder(players: readonly Player[], seedOrRng: string | SeededRng, categoryOrder: readonly AuctionCategory[] = AUCTION_CATEGORY_ORDER): string[] {
  const rng = typeof seedOrRng === "string" ? createNamedRng(seedOrRng, "auction-order") : seedOrRng;
  const groups = Object.fromEntries(AUCTION_CATEGORY_ORDER.map((category) => [category, [] as Player[]])) as Record<AuctionCategory, Player[]>;
  players.forEach((player) => groups[categoryForPlayer(player)].push(player));

  return categoryOrder.flatMap((category) => {
    const sorted = [...groups[category]].sort((left, right) => left.playerId.localeCompare(right.playerId));
    return shuffle(sorted, rng.fork(category)).map((player) => player.playerId);
  });
}

export function describeAuctionOrder(players: readonly Player[], seed: string, categoryOrder: readonly AuctionCategory[] = AUCTION_CATEGORY_ORDER): AuctionOrderEntry[] {
  const byId = new Map(players.map((player) => [player.playerId, player]));
  return generateAuctionOrder(players, seed, categoryOrder).map((playerId, position) => {
    const player = byId.get(playerId);
    const category = player ? categoryForPlayer(player) : "ACCELERATED";
    return { playerId, category, categoryIndex: categoryRank(category), position };
  });
}

/** One-based lot number within the active category, for broadcast round labels. */
export function categoryRoundAt(order: readonly string[], position: number, players: readonly Player[]): number {
  const byId = new Map(players.map((player) => [player.playerId, player]));
  const current = byId.get(order[position] ?? "");
  if (!current) return 1;
  const category = categoryForPlayer(current);
  let round = 0;
  for (let index = 0; index <= position; index += 1) {
    const player = byId.get(order[index] ?? "");
    if (player && categoryForPlayer(player) === category) round += 1;
  }
  return Math.max(1, round);
}
