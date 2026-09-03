import { describe, expect, it } from "vitest";
import { PLAYERS_2027 } from "@/data/players/2027";
import { FRANCHISES_2027 } from "@/data/teams/franchises";
import { RULE_SET_SNAPSHOT } from "@/data/rules";
import { createBidderStates, evaluatePeerMarket, type PeerMarketContext } from "./peerMarket";

const player = PLAYERS_2027[0];
const rules = {
  minSquadSize: RULE_SET_SNAPSHOT.auction.minSquadSize,
  maxSquadSize: RULE_SET_SNAPSHOT.auction.maxSquadSize,
  maxOverseas: RULE_SET_SNAPSHOT.auction.maxOverseas
};

function context(overrides: Partial<PeerMarketContext> = {}): PeerMarketContext {
  return {
    seed: "peer-market-unit",
    lotIndex: 0,
    round: 1,
    userFranchiseId: "KKR",
    currentLeaderId: null,
    currentBid: 0,
    nextPrice: player.auctionData.basePrice,
    player,
    players: PLAYERS_2027,
    remainingPlayers: PLAYERS_2027,
    franchises: FRANCHISES_2027,
    budgets: Object.fromEntries(FRANCHISES_2027.filter((team) => team.id !== "KKR").map((team) => [team.id, 50])),
    squads: Object.fromEntries(FRANCHISES_2027.filter((team) => team.id !== "KKR").map((team) => [team.id, []])),
    rules,
    bidIncrementBands: RULE_SET_SNAPSHOT.auction.bidIncrementBands,
    previousStates: createBidderStates(FRANCHISES_2027),
    ...overrides
  };
}

describe("peer market", () => {
  it("evaluates every rival and replays deterministically", () => {
    const first = evaluatePeerMarket(context());
    const second = evaluatePeerMarket(context());
    expect(first).toEqual(second);
    expect(first.activity).toHaveLength(FRANCHISES_2027.length - 1);
  });

  it("locks teams without budget while allowing a funded peer to bid", () => {
    const budgets = Object.fromEntries(FRANCHISES_2027.filter((team) => team.id !== "KKR").map((team) => [team.id, team.id === "MI" ? 50 : 0]));
    const result = evaluatePeerMarket(context({ budgets }));
    expect(result.selected?.team.id).toBe("MI");
    expect(result.bidderStates.RCB.status).toBe("BUDGET_LOCKED");
    expect(result.activity.find((activity) => activity.teamId === "RCB")?.status).toBe("INELIGIBLE");
  });

  it("never lets the current leader counter its own bid", () => {
    const previousStates = createBidderStates(FRANCHISES_2027);
    previousStates.MI = { ...previousStates.MI, status: "LEADING", lastBid: player.auctionData.basePrice };
    const result = evaluatePeerMarket(context({ currentLeaderId: "MI", currentBid: player.auctionData.basePrice, nextPrice: player.auctionData.basePrice + 0.25, previousStates }));
    expect(result.selected?.team.id).not.toBe("MI");
    expect(result.activity.find((activity) => activity.teamId === "MI")?.status).toBe("WATCHING");
  });

  it("keeps every rival represented after a human-led round", () => {
    const previousStates = createBidderStates(FRANCHISES_2027);
    previousStates.KKR = { ...previousStates.KKR, status: "LEADING", lastBid: 2 };
    const result = evaluatePeerMarket(context({
      currentLeaderId: "KKR",
      currentBid: 2,
      nextPrice: 2.25,
      previousStates
    }));
    const rivalIds = FRANCHISES_2027.filter((team) => team.id !== "KKR").map((team) => team.id);
    expect(result.activity.map((activity) => activity.teamId).sort()).toEqual(rivalIds.sort());
    expect(Object.keys(result.bidderStates).sort()).toEqual(FRANCHISES_2027.map((team) => team.id).sort());
    expect(result.activity.every((activity) => activity.round === 1)).toBe(true);
  });

  it("does not re-evaluate budget-locked peers on later rounds", () => {
    const first = evaluatePeerMarket(context({ budgets: Object.fromEntries(FRANCHISES_2027.filter((team) => team.id !== "KKR").map((team) => [team.id, team.id === "MI" ? 50 : 0])) }));
    const second = evaluatePeerMarket(context({ round: 2, currentLeaderId: first.selected?.team.id ?? null, budgets: Object.fromEntries(FRANCHISES_2027.filter((team) => team.id !== "KKR").map((team) => [team.id, team.id === "MI" ? 50 : 0])), previousStates: first.bidderStates }));
    expect(second.bidderStates.RCB.status).toBe("BUDGET_LOCKED");
    expect(second.activity.find((activity) => activity.teamId === "RCB")?.status).toBe("INELIGIBLE");
    expect(second.bidderStates.RCB.decisionCount).toBe(first.bidderStates.RCB.decisionCount);
  });
});
