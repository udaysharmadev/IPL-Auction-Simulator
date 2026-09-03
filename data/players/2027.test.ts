import { describe, expect, it } from "vitest";
import { PLAYERS, PLAYERS_2027, PLAYER_DATASET_VALIDATION } from "@/data/mockData";
import { PLAYER_SOURCE_COVERAGE, PLAYER_SOURCE_REFERENCE_VALIDATION } from "@/data/players/2027";
import { PLAYER_ASSET_MANIFEST_VERSION } from "@/data/players/assets";
import { playerSourceCoverage } from "@/data/sources/playerSources";
import { AUCTION_CATEGORY_ORDER, groupByAuctionCategory, sortByAuctionCategory } from "@/data/auction/categoryOrder";

describe("IPL 2027 player dataset", () => {
  it("contains a valid production-shaped pool with broad role coverage", () => {
    expect(PLAYER_DATASET_VALIDATION).toEqual({ valid: true, errors: [] });
    expect(PLAYER_SOURCE_REFERENCE_VALIDATION).toEqual({ valid: true, errors: [] });
    expect(PLAYERS_2027.length).toBeGreaterThanOrEqual(120);
    expect(new Set(PLAYERS_2027.map((player) => player.role.primary))).toEqual(new Set(["BAT", "BOWL", "AR", "WK"]));
    expect(new Set(PLAYERS_2027.map((player) => player.auctionData.category))).toEqual(new Set(AUCTION_CATEGORY_ORDER));
  });

  it("ships explicit portrait and simulation provenance for every player", () => {
    PLAYERS_2027.forEach((player) => {
      expect(player.assets.manifestVersion).toBe(PLAYER_ASSET_MANIFEST_VERSION);
      expect(player.assets.portrait.alt).toContain(player.identity.name);
      expect(player.simulationData.modelVersion).toBeTruthy();
      expect(player.provenance.sourceRefs.length).toBeGreaterThan(0);
      expect(player.realData.dataStatus).toBe(player.provenance.stats);
      expect(player.dataQuality?.historicalStats).toBe(player.provenance.stats);
      expect(player.dataQuality?.auctionTerms).toBe("PROJECTED");
      if (player.provenance.stats === "SIMULATION_GENERATED") expect(player.assets.portrait.kind).toBe("GENERATED");
    });
  });

  it("reports source coverage instead of implying the projected pack is licensed", () => {
    expect(PLAYER_SOURCE_COVERAGE).toEqual(playerSourceCoverage(PLAYERS_2027));
    expect(PLAYER_SOURCE_COVERAGE).toMatchObject({
      playerCount: PLAYERS_2027.length,
      verifiedIdentities: 0,
      curatedIdentities: 70,
      generatedIdentities: 96,
      verifiedStatSnapshots: 0,
      projectedStatSnapshots: PLAYERS_2027.length,
      verifiedAuctionTerms: 0,
      verifiedAvailability: 0,
      licensedPortraits: 0,
      generatedPortraits: PLAYERS_2027.length,
      unresolvedSourceRefs: []
    });
  });

  it("keeps stable compatibility aliases for existing consumers", () => {
    expect(PLAYERS).toBe(PLAYERS_2027);
    expect(new Set(PLAYERS_2027.map((player) => player.playerId)).size).toBe(PLAYERS_2027.length);
    expect(new Set(PLAYERS_2027.map((player) => player.identity.imageSlug)).size).toBe(PLAYERS_2027.length);
  });

  it("sorts and groups lots by the explicit broadcast category order", () => {
    const sorted = sortByAuctionCategory(PLAYERS_2027);
    expect(sorted[0].auctionData.category).toBe("MARQUEE");
    expect(sorted.at(-1)?.auctionData.category).toBe("ACCELERATED");
    const groups = groupByAuctionCategory(PLAYERS_2027);
    AUCTION_CATEGORY_ORDER.forEach((category) => expect(groups[category].length).toBeGreaterThan(0));
  });
});
