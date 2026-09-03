import { describe, expect, it } from "vitest";
import { PLAYERS_2027 } from "@/data/players/2027";
import { RULE_SET_SNAPSHOT } from "@/data/rules";
import { createAuction } from "@/engine/auctionEngine";
import { auctionFormatDescription, auctionMatchesSession, QUICK_PLAYER_LIMIT, resolveAuctionSession } from "./sessionConfig";

describe("auction session setup", () => {
  it("resolves authentic mode to the full projected pool and rules", () => {
    const session = resolveAuctionSession({ format: "AUTHENTIC", difficulty: "STRATEGIST", graphicsQuality: "HIGH", seed: "alpha" });
    expect(session.players).toHaveLength(PLAYERS_2027.length);
    expect(session.rules.version).toBe(RULE_SET_SNAPSHOT.version);
    expect(session.rules.status).toBe("PROJECTED");
    expect(session.setup.rulesVersion).toBe(RULE_SET_SNAPSHOT.version);
  });

  it("resolves quick mode to a deterministic compact pool and compact constraints", () => {
    const first = resolveAuctionSession({ format: "QUICK", difficulty: "ROOKIE", graphicsQuality: "PERFORMANCE", seed: "quick-seed" });
    const second = resolveAuctionSession({ format: "QUICK", difficulty: "ROOKIE", graphicsQuality: "PERFORMANCE", seed: "quick-seed" });
    expect(first.players).toHaveLength(QUICK_PLAYER_LIMIT);
    expect(first.players.map((player) => player.playerId)).toEqual(second.players.map((player) => player.playerId));
    expect(new Set(first.players.map((player) => player.playerId)).size).toBe(QUICK_PLAYER_LIMIT);
    expect(first.rules.auction.startingPurse).toBe(30);
    expect(first.rules.auction.minSquadSize).toBe(8);
    expect(first.rules.auction.acceleratedEnabled).toBe(false);
    expect(first.setup.rulesVersion).toContain("QUICK");
  });

  it("resolves custom mode to an explicit sandbox ruleset", () => {
    const session = resolveAuctionSession({ format: "CUSTOM", difficulty: "GM", graphicsQuality: "ULTRA", seed: "sandbox" });
    expect(session.players).toHaveLength(PLAYERS_2027.length);
    expect(session.rules.status).toBe("CUSTOM");
    expect(session.rules.auction.startingPurse).toBe(75);
    expect(session.rules.auction.maxOverseas).toBe(10);
    expect(session.setup.rulesVersion).toContain("SANDBOX");
  });

  it("creates an auction aggregate from the resolved profile", () => {
    const session = resolveAuctionSession({ format: "QUICK", difficulty: "GM", graphicsQuality: "PERFORMANCE", seed: "engine-session" });
    const auction = createAuction("MI", session.setup.seed, session.rules, session.players, session.setup.difficulty, {
      format: session.setup.format,
      graphicsQuality: session.setup.graphicsQuality,
      poolLabel: session.poolLabel
    });

    expect(auction.order).toHaveLength(QUICK_PLAYER_LIMIT);
    expect(auction.playerPoolIds).toEqual(auction.order);
    expect(auction.userBudget).toBe(30);
    expect(auction.difficulty).toBe("GM");
    expect(auction.format).toBe("QUICK");
    expect(auction.graphicsQuality).toBe("PERFORMANCE");
    expect(auction.poolLabel).toBe(session.poolLabel);
  });

  it("normalizes blank seeds and exposes honest setup metadata", () => {
    const session = resolveAuctionSession({ format: "QUICK", seed: "   " });
    expect(session.setup.seed).toBe("2027-AUCTION-847293");
    expect(auctionFormatDescription("QUICK").poolLabel).toContain(String(QUICK_PLAYER_LIMIT));
  });

  it("falls back safely when persisted setup values are malformed", () => {
    const session = resolveAuctionSession({
      format: "NOT_A_FORMAT" as never,
      difficulty: 42 as never,
      graphicsQuality: {} as never,
      seed: 99 as never,
      rulesVersion: null as never
    });

    expect(session.setup).toEqual({
      format: "AUTHENTIC",
      difficulty: "STRATEGIST",
      graphicsQuality: "HIGH",
      seed: "2027-AUCTION-847293",
      rulesVersion: RULE_SET_SNAPSHOT.version
    });
    expect(session.players).toHaveLength(PLAYERS_2027.length);
  });

  it("matches the selected gameplay profile but ignores graphics-only changes", () => {
    const setup = { format: "QUICK" as const, difficulty: "GM" as const, graphicsQuality: "ULTRA" as const, seed: "profile-seed" };
    expect(auctionMatchesSession({ userFranchiseId: "MI", seed: "profile-seed", format: "QUICK", difficulty: "GM", rulesVersion: `${RULE_SET_SNAPSHOT.version}-QUICK` }, "MI", { ...setup, graphicsQuality: "PERFORMANCE" })).toBe(true);
    expect(auctionMatchesSession({ userFranchiseId: "MI", seed: "profile-seed", format: "QUICK", difficulty: "STRATEGIST", rulesVersion: `${RULE_SET_SNAPSHOT.version}-QUICK` }, "MI", setup)).toBe(false);
  });

  it("only treats metadata-free saves as the legacy default profile", () => {
    const legacy = { userFranchiseId: "KKR", seed: "legacy-seed" };
    expect(auctionMatchesSession(legacy, "KKR", { seed: "legacy-seed" })).toBe(true);
    expect(auctionMatchesSession(legacy, "KKR", { format: "QUICK", seed: "legacy-seed" })).toBe(false);
  });
});
