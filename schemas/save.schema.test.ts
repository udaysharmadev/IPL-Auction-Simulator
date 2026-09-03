import { describe, expect, it } from "vitest";
import { FRANCHISE_IDS } from "@/data/teams/franchises";
import { createAuction } from "@/engine/auctionEngine";
import { createAuctionSaveRecord, isAuctionState, parseAuctionSaveRecord } from "@/schemas/save.schema";

function validActivity() {
  return {
    id: "0-market-1-MI",
    teamId: "MI",
    status: "BID" as const,
    bid: 2,
    maxBid: 7.5,
    psychology: "COMPETING" as const,
    needScore: 4,
    alternativeCount: 3,
    reason: "MI raises with room below its model ceiling.",
    round: 1
  };
}

describe("auction save peer-market validation", () => {
  it("accepts current peer state and legacy snapshots without optional fields", () => {
    const auction = { ...createAuction("KKR", "peer-save-valid"), marketRound: 1, peerActivity: [validActivity()] };
    expect(Object.keys(auction.bidderStates ?? {})).toEqual(expect.arrayContaining([...FRANCHISE_IDS]));
    expect(isAuctionState(auction)).toBe(true);

    const { bidderStates: _bidderStates, peerActivity: _peerActivity, marketRound: _marketRound, ...legacyAuction } = auction;
    expect(isAuctionState(legacyAuction)).toBe(true);
    const record = createAuctionSaveRecord("legacy", legacyAuction, {
      rulesVersion: legacyAuction.rulesVersion,
      datasetVersion: legacyAuction.dataVersion,
      simulationModelVersion: legacyAuction.simulationModelVersion
    }, "2026-08-26T00:00:00.000Z");
    expect(parseAuctionSaveRecord(record).success).toBe(true);
  });

  it("requires a complete, internally consistent ten-franchise bidder map", () => {
    const auction = createAuction("KKR", "peer-save-bidders");
    const bidderStates = { ...auction.bidderStates! };
    delete bidderStates.GT;
    expect(isAuctionState({ ...auction, bidderStates })).toBe(false);

    expect(isAuctionState({
      ...auction,
      bidderStates: { ...auction.bidderStates, MI: { ...auction.bidderStates!.MI, teamId: "RCB" } }
    })).toBe(false);
    expect(isAuctionState({
      ...auction,
      bidderStates: { ...auction.bidderStates, MI: { ...auction.bidderStates!.MI, status: "CHEATING" } }
    })).toBe(false);
    expect(isAuctionState({
      ...auction,
      bidderStates: { ...auction.bidderStates, MI: { ...auction.bidderStates!.MI, maxBid: Number.NaN } }
    })).toBe(false);
    expect(isAuctionState({
      ...auction,
      bidderStates: { ...auction.bidderStates, MI: { ...auction.bidderStates!.MI, needScore: 101 } }
    })).toBe(false);
  });

  it("rejects malformed peer activity and out-of-range market rounds", () => {
    const auction = createAuction("KKR", "peer-save-activity");
    const valid = { ...auction, marketRound: 1, peerActivity: [validActivity()] };
    expect(isAuctionState(valid)).toBe(true);
    expect(isAuctionState({ ...valid, marketRound: -1 })).toBe(false);
    expect(isAuctionState({ ...valid, marketRound: 257 })).toBe(false);
    expect(isAuctionState({ ...valid, peerActivity: [{ ...validActivity(), teamId: "UNKNOWN" }] })).toBe(false);
    expect(isAuctionState({ ...valid, peerActivity: [{ ...validActivity(), status: "WAIT" }] })).toBe(false);
    expect(isAuctionState({ ...valid, peerActivity: [{ ...validActivity(), bid: -0.25 }] })).toBe(false);
    expect(isAuctionState({ ...valid, peerActivity: [{ ...validActivity(), status: "WATCHING", bid: 2 }] })).toBe(false);
    expect(isAuctionState({ ...valid, peerActivity: [{ ...validActivity(), round: 2 }] })).toBe(false);
    expect(isAuctionState({ ...valid, peerActivity: [validActivity(), validActivity()] })).toBe(false);
  });

  it("validates optional session metadata and complete rival maps", () => {
    const auction = createAuction("KKR", "session-save-shape", undefined, undefined, "GM", {
      format: "CUSTOM",
      graphicsQuality: "ULTRA",
      poolLabel: "Full sandbox pool"
    });
    expect(isAuctionState(auction)).toBe(true);
    expect(isAuctionState({ ...auction, difficulty: "IMPOSSIBLE" })).toBe(false);
    expect(isAuctionState({ ...auction, format: "ARCADE" })).toBe(false);
    expect(isAuctionState({ ...auction, graphicsQuality: "CINEMA" })).toBe(false);
    expect(isAuctionState({ ...auction, poolLabel: "" })).toBe(false);
    expect(isAuctionState({ ...auction, playerPoolIds: [...auction.order, auction.order[0]] })).toBe(false);

    const incompleteBudgets = { ...auction.aiBudgets };
    delete incompleteBudgets.MI;
    expect(isAuctionState({ ...auction, aiBudgets: incompleteBudgets })).toBe(false);
    expect(isAuctionState({ ...auction, aiSquads: { ...auction.aiSquads, KKR: [] } })).toBe(false);
    expect(isAuctionState({ ...auction, highestBidder: "UNKNOWN" })).toBe(false);
  });

  it("validates optional session metadata while accepting legacy omissions", () => {
    const auction = createAuction("KKR", "session-metadata");
    expect(isAuctionState({ ...auction, difficulty: "GM", format: "AUTHENTIC", graphicsQuality: "ULTRA", poolLabel: "166 player full pool" })).toBe(true);
    expect(isAuctionState({ ...auction, difficulty: "IMPOSSIBLE" })).toBe(false);
    expect(isAuctionState({ ...auction, format: "UNKNOWN" })).toBe(false);
    expect(isAuctionState({ ...auction, graphicsQuality: "8K" })).toBe(false);
    expect(isAuctionState({ ...auction, poolLabel: "x".repeat(161) })).toBe(false);
    const { difficulty: _difficulty, format: _format, graphicsQuality: _graphicsQuality, poolLabel: _poolLabel, playerPoolIds: _playerPoolIds, ...legacy } = auction;
    expect(isAuctionState(legacy)).toBe(true);
  });
});
