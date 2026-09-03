import { describe, expect, it } from "vitest";
import { activePlayerPool, advanceAuction, createAuction, drainAutomatedMarket, gradeAuction, isUserBidder, nextBid, processPass, processUserBid, resolveBidderId } from "./auctionEngine";
import { FRANCHISES_2027 } from "@/data/teams/franchises";
import { PLAYERS_2027 } from "@/data/players/2027";
import { validateSquad } from "@/engine/squad/squadRules";

describe("auction engine", () => {
  it("uses predictable bid increments", () => { expect(nextBid(0)).toBe(0.25); expect(nextBid(5)).toBe(5.5); expect(nextBid(10)).toBe(11); });
  it("replays the same lot order from a seed", () => { expect(createAuction("KKR", "same").order).toEqual(createAuction("KKR", "same").order); expect(createAuction("KKR", "same").order).not.toEqual(createAuction("KKR", "different").order); });
  it("allows a bid only after player presentation", () => { const auction = createAuction(); const started = advanceAuction(auction); const bid = processUserBid(started); expect(bid.currentBid).toBeGreaterThan(0); expect(bid.events.some((event) => event.type === "bid" && event.text.startsWith("You bid"))).toBe(true); });
  it("returns a report for an acquired squad", () => { let auction = createAuction(); auction = advanceAuction(auction); auction = processUserBid(auction); expect(gradeAuction({ ...auction, userSquad: [auction.currentPlayerId], events: [{ id: "x", text: "sold", type: "sold", playerId: auction.currentPlayerId, price: 1 }] }).grade).toBeTruthy(); });
  it("protects a configured Smart Max ceiling", () => { const auction = createAuction(); const protectedState = processUserBid({ ...auction, smartMaxEnabled: true, userMaxBid: 0.1 }); expect(protectedState.currentBid).toBe(0); expect(protectedState.message).toContain("Smart Max protected"); });
  it("records a user bid without silently draining all rival turns", () => {
    const started = advanceAuction(createAuction("KKR", "stepwise-human-bid"));
    const peerCountBefore = started.peerActivity?.length ?? 0;
    const bid = processUserBid(started);
    expect(bid.currentBid).toBeGreaterThan(0);
    expect(bid.highestBidder).toBe("YOU");
    expect(bid.peerActivity?.length ?? 0).toBe(peerCountBefore);
    expect(bid.phase).toBe("BIDDING");
  });

  it("canonicalizes user and rival bidder aliases consistently", () => {
    const auction = createAuction("KKR", "bidder-aliases");
    expect(resolveBidderId("YOU", "KKR")).toBe("KKR");
    expect(resolveBidderId("KKR", "KKR")).toBe("KKR");
    expect(resolveBidderId("MI", "KKR")).toBe("MI");
    expect(isUserBidder(auction, "YOU")).toBe(true);
    expect(isUserBidder(auction, "KKR")).toBe(true);
    expect(isUserBidder(auction, "MI")).toBe(false);
  });

  it("supports a resolved custom pool and difficulty as deterministic state inputs", () => {
    const pool = PLAYERS_2027.slice(0, 12);
    const first = createAuction("MI", "compact-engine-pool", { ...createAuction().ruleSet, auction: { ...createAuction().ruleSet.auction, minSquadSize: 2, maxSquadSize: 6 } }, pool, "GM", { format: "QUICK", poolLabel: "12 player test pool" });
    const second = createAuction("MI", "compact-engine-pool", first.ruleSet, pool, "GM", { format: "QUICK", poolLabel: "12 player test pool" });
    expect(first.order).toHaveLength(pool.length);
    expect(first.playerPoolIds).toEqual(first.order);
    expect(first.difficulty).toBe("GM");
    expect(first.format).toBe("QUICK");
    expect(first.poolLabel).toBe("12 player test pool");
    expect(first.order).toEqual(second.order);
  });

  it("exposes the active session pool to exports and tooling", () => {
    const pool = PLAYERS_2027.slice(0, 12);
    const auction = createAuction("MI", "active-pool-export", createAuction().ruleSet, pool, "STRATEGIST", { format: "QUICK" });
    expect(activePlayerPool(auction).map((player) => player.playerId).sort()).toEqual(pool.map((player) => player.playerId).sort());
    expect(activePlayerPool()).toHaveLength(PLAYERS_2027.length);
  });

  it("rejects non-finite user increments without mutating the auction", () => {
    const auction = advanceAuction(createAuction("KKR", "invalid-increment"));
    const result = processUserBid(auction, Number.NaN);
    expect(result.currentBid).toBe(auction.currentBid);
    expect(result.events).toEqual(auction.events);
    expect(result.message).toContain("valid bid increment");
  });

  it("makes a user pass idempotent and irreversible for the lot", () => {
    const started = advanceAuction(createAuction("KKR", "pass-idempotency"));
    const passed = processPass(started);
    expect(passed.bidderStates?.KKR.status).toBe("FOLDED");
    const repeatedPass = processPass(passed);
    expect(repeatedPass.marketRound).toBe(passed.marketRound);
    expect(repeatedPass.message).toContain("already out");
    const reentry = processUserBid(passed);
    expect(reentry.currentBid).toBe(passed.currentBid);
    expect(reentry.message).toContain("passed on this lot");
  });
  it("awards an AI-leading lot when the user passes", () => {
    const auction = createAuction();
    const rivalLeading = { ...auction, phase: "BIDDING" as const, currentBid: 2, highestBidder: "MI" };
    const settled = processPass(rivalLeading);
    expect(settled.phase).toBe("SOLD");
    expect(settled.aiSquads.MI).toContain(auction.currentPlayerId);
    expect(settled.events.at(-1)?.type).toBe("sold");
  });

  it("evaluates every rival table and keeps a peer activity ledger", () => {
    const auction = advanceAuction(createAuction("KKR", "peer-ledger-test"));
    expect(Object.keys(auction.bidderStates ?? {})).toHaveLength(FRANCHISES_2027.length);
    expect((auction.peerActivity ?? []).length).toBe(FRANCHISES_2027.length - 1);
    expect(new Set((auction.peerActivity ?? []).map((activity) => activity.teamId)).size).toBe(FRANCHISES_2027.length - 1);
    expect((auction.marketRound ?? 0)).toBeGreaterThan(0);
  });

  it("replays peer decisions exactly from the same seed", () => {
    const first = advanceAuction(createAuction("KKR", "peer-determinism"));
    const second = advanceAuction(createAuction("KKR", "peer-determinism"));
    expect(first.currentBid).toBe(second.currentBid);
    expect(first.highestBidder).toBe(second.highestBidder);
    expect(first.peerActivity).toEqual(second.peerActivity);
    expect(first.bidderStates).toEqual(second.bidderStates);
  });

  it("settles safely before live market rounds exceed the persistence limit", () => {
    const state = {
      ...createAuction("KKR", "market-round-cap"),
      phase: "BIDDING" as const,
      marketRound: 256,
      currentBid: 2,
      highestBidder: "MI"
    };
    const settled = advanceAuction(state);
    expect(settled.phase).toBe("SOLD");
    expect(settled.marketRound).toBe(256);
    expect(settled.aiSquads.MI).toContain(state.currentPlayerId);
  });

  it("resolves a full AI market without duplicate ownership or illegal purses", () => {
    let auction = createAuction("KKR", "full-peer-market");
    let transitions = 0;
    while (!auction.completed && transitions < auction.order.length * 4) {
      auction = ["FIRST_BID", "BIDDING", "FINAL_CALL"].includes(auction.phase)
        ? drainAutomatedMarket(processPass(auction))
        : advanceAuction(auction);
      transitions += 1;
    }

    expect(auction.completed).toBe(true);
    expect(Object.values(auction.aiBudgets).every((budget) => budget >= 0)).toBe(true);
    expect(Object.values(auction.aiSquads).every((squad) => squad.length > 0)).toBe(true);
    const owned = [...auction.userSquad, ...Object.values(auction.aiSquads).flat()];
    expect(new Set(owned).size).toBe(owned.length);
    Object.values(auction.aiSquads).forEach((squad) => {
      expect(validateSquad(squad, PLAYERS_2027, {
        minSquadSize: auction.ruleSet.auction.minSquadSize,
        maxSquadSize: auction.ruleSet.auction.maxSquadSize,
        maxOverseas: auction.ruleSet.auction.maxOverseas
      }).valid).toBe(true);
    });
  });
});
