import { describe, expect, it } from "vitest";
import { PLAYERS } from "@/data/mockData";
import { createAuction, type AuctionState } from "./auctionEngine";
import { auctionMoments, scarcityFor, shotFor, warningsFor } from "./auctionPresentation";
import { resolveAuctionSession } from "@/engine/setup/sessionConfig";

describe("auction presentation model", () => {
  it("derives a camera shot from authoritative auction state", () => { const state = createAuction(); expect(shotFor(state)).toBe("PLAYER_REVEAL"); expect(shotFor({ ...state, phase: "FINAL_CALL" })).toBe("FINAL_CALL"); });
  it("recognizes a franchise-id alias as the user's bid focus", () => {
    const state = createAuction("KKR");
    expect(shotFor({ ...state, currentBid: 2, highestBidder: "KKR" })).toBe("BID_FOCUS");
  });
  it("returns a complete scarcity snapshot", () => { const scarcity = scarcityFor(createAuction()); expect(Object.keys(scarcity)).toEqual(["BAT", "BOWL", "AR", "WK"]); expect(scarcity.WK.remaining).toBeGreaterThan(0); });
  it("warns when a bid crosses the user ceiling", () => { const state = { ...createAuction(), currentBid: 10, userMaxBid: 8 } as AuctionState; expect(warningsFor(state, PLAYERS[0]).some((warning) => warning.title.includes("planned maximum"))).toBe(true); });
  it("detects auction value moments from sold events", () => { const player = PLAYERS[0]; const state = { ...createAuction(), events: [{ id: "sold", type: "sold" as const, text: "sold", playerId: player.playerId, price: player.valuation.fairValue * 0.5 }] }; expect(auctionMoments(state)[0]?.type).toBe("STEAL"); });
  it("derives scarcity and moments from the active session pool", () => {
    const session = resolveAuctionSession({ format: "QUICK", seed: "presentation-pool" });
    const state = createAuction("KKR", session.setup.seed, session.rules, session.players, session.setup.difficulty, { format: session.setup.format });
    const expectedBatters = state.order.slice(state.currentIndex).filter((id) => session.players.some((player) => player.playerId === id && player.role.primary === "BAT")).length;
    expect(scarcityFor(state).BAT.remaining).toBe(expectedBatters);
    expect(scarcityFor(state).BAT.remaining).toBeLessThan(PLAYERS.length);
  });
});
