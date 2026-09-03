import type { AuctionCategory, Player } from "@/data/players/types";

/** The broadcast order is intentionally explicit so future ruleset versions can replace it. */
export const AUCTION_CATEGORY_ORDER: readonly AuctionCategory[] = [
  "MARQUEE",
  "CAPPED_INDIAN",
  "CAPPED_OVERSEAS",
  "UNCAPPED",
  "ACCELERATED"
];

export const AUCTION_CATEGORY_LABELS: Record<AuctionCategory, string> = {
  MARQUEE: "Marquee Set",
  CAPPED_INDIAN: "Capped Indians",
  CAPPED_OVERSEAS: "Capped Overseas",
  UNCAPPED: "Uncapped & Emerging",
  ACCELERATED: "Accelerated Round"
};

export function categoryRank(category: AuctionCategory) {
  return AUCTION_CATEGORY_ORDER.indexOf(category);
}

export function sortByAuctionCategory(players: readonly Player[]): Player[] {
  return [...players].sort((left, right) => {
    const categoryDelta = categoryRank(left.auctionData.category) - categoryRank(right.auctionData.category);
    if (categoryDelta !== 0) return categoryDelta;
    return left.playerId.localeCompare(right.playerId);
  });
}

export function groupByAuctionCategory(players: readonly Player[]): Record<AuctionCategory, Player[]> {
  const groups = Object.fromEntries(AUCTION_CATEGORY_ORDER.map((category) => [category, [] as Player[]])) as Record<AuctionCategory, Player[]>;
  players.forEach((player) => groups[player.auctionData.category].push(player));
  return groups;
}
