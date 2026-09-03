import { describe, expect, it } from "vitest";
import { PLAYERS_2027 } from "@/data/players/2027";
import { AUCTION_CATEGORY_ORDER } from "@/data/auction/categoryOrder";
import { categoryForPlayer, describeAuctionOrder, generateAuctionOrder } from "./orderGenerator";

describe("auction order generator", () => {
  it("keeps category groups in the broadcast order", () => {
    const entries = describeAuctionOrder(PLAYERS_2027, "category-seed");
    const ranks = entries.map((entry) => AUCTION_CATEGORY_ORDER.indexOf(entry.category));
    expect(ranks).toEqual([...ranks].sort((left, right) => left - right));
    expect(entries.every((entry) => entry.category === categoryForPlayer(PLAYERS_2027.find((player) => player.playerId === entry.playerId)!))).toBe(true);
  });

  it("is deterministic for a seed and changes for another seed", () => {
    expect(generateAuctionOrder(PLAYERS_2027, "same-seed")).toEqual(generateAuctionOrder(PLAYERS_2027, "same-seed"));
    expect(generateAuctionOrder(PLAYERS_2027, "same-seed")).not.toEqual(generateAuctionOrder(PLAYERS_2027, "different-seed"));
  });
});

