import { describe, expect, it } from "vitest";
import { FRANCHISES } from "@/data/mockData";
import { createAuction } from "@/engine/auctionEngine";
import { bidderRoster, peerActivityFor } from "@/components/auction/auctionViewModel";
import { resolveAuctionSession } from "@/engine/setup/sessionConfig";

describe("auction view model", () => {
  it("keeps every IPL franchise visible in the live bidder roster", () => {
    const state = createAuction("KKR", "ui-roster-seed");
    const roster = bidderRoster(state);

    expect(roster).toHaveLength(FRANCHISES.length);
    expect(new Set(roster.map((bidder) => bidder.team.id))).toEqual(new Set(FRANCHISES.map((team) => team.id)));
    expect(roster.find((bidder) => bidder.team.id === "KKR")?.budget).toBe(state.userBudget);
    expect(roster.find((bidder) => bidder.team.id === "KKR")?.status).toBe("YOU");
  });

  it("keeps user presentation status distinct from the engine's eligible state", () => {
    const state = createAuction("KKR", "ui-user-status");
    const passed = { ...state, bidderStates: { ...state.bidderStates, KKR: { ...state.bidderStates!.KKR, status: "FOLDED" as const } } };
    expect(bidderRoster(passed).find((bidder) => bidder.team.id === "KKR")?.status).toBe("FOLDED");
  });

  it("derives truthful peer activity from events for legacy saves", () => {
    const base = createAuction("KKR", "legacy-ui-seed");
    const state = {
      ...base,
      bidderStates: undefined,
      peerActivity: undefined,
      events: [
        ...base.events,
        { id: "legacy-bid", type: "bid" as const, text: "MI enters", actor: "MI", playerId: base.currentPlayerId, price: 2 }
      ]
    };

    expect(peerActivityFor(state)).toEqual([
      expect.objectContaining({ id: "legacy-bid", teamId: "MI", status: "BID", bid: 2 })
    ]);
  });

  it("resolves the current player from a compact session pool", () => {
    const session = resolveAuctionSession({ format: "QUICK", seed: "ui-compact-seed" });
    const state = createAuction("KKR", session.setup.seed, session.rules, session.players, session.setup.difficulty, { format: "QUICK" });
    expect(state.playerPoolIds).toHaveLength(session.players.length);
    expect(state.currentPlayerId).toBeTruthy();
    expect(state.currentPlayerId).toBeDefined();
  });
});
