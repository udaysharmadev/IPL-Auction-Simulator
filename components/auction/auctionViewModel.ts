import { FRANCHISES, PLAYERS } from "@/data/mockData";
import type { Franchise } from "@/data/teams/franchises";
import type { AuctionEvent, AuctionState } from "@/engine/auctionEngine";
import { playersForState as activePlayersForState } from "@/engine/auctionPresentation";

/**
 * Presentation-only contracts. The engine owns these values; the view model
 * merely normalises them so the screen can render old saves and the live
 * peer-vs-peer state with the same UI.
 */
export type BidderUiStatus = "YOU" | "ELIGIBLE" | "BIDDING" | "LEADING" | "FOLDED" | "BUDGET_LOCKED" | "SQUAD_LOCKED" | "WON" | "WATCHING";

export type BidderUiState = {
  team: Franchise;
  status: BidderUiStatus;
  budget: number;
  squadSize: number;
  lastBid: number | null;
  bidCount: number;
  maxBid: number | null;
  psychology?: string;
  needScore?: number;
  alternativeCount?: number;
  reason?: string;
};

type EngineBidderState = Partial<{
  teamId: string;
  status: BidderUiStatus;
  budget: number;
  lastBid: number;
  maxBid: number;
  decisionCount: number;
  psychology: string;
  needScore: number;
  alternativeCount: number;
  reason: string;
}>;

type EnginePeerActivity = Partial<{
  id: string;
  teamId: string;
  status: "BID" | "WATCHING" | "FOLD" | "INELIGIBLE";
  bid: number;
  maxBid: number;
  psychology: string;
  needScore: number;
  alternativeCount: number;
  reason: string;
  round: number;
}>;

type ExtendedAuctionState = AuctionState & {
  bidderStates?: Record<string, EngineBidderState>;
  peerActivity?: EnginePeerActivity[];
  marketRound?: number;
};

function extended(state: AuctionState) { return state as ExtendedAuctionState; }

function eventActorMatches(actor: string | undefined, team: Franchise, userFranchiseId: string) {
  if (!actor) return false;
  return actor === team.id || actor === team.shortName || (team.id === userFranchiseId && actor === "YOU");
}

function safeNumber(value: unknown, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }

/**
 * Returns one row for every franchise in the room. No visual limit is applied:
 * the ten-team league remains visible even when a run is restored from a
 * pre-peer-state save.
 */
export function bidderRoster(state: AuctionState): BidderUiState[] {
  const source = extended(state);
  const rawStates = source.bidderStates ?? {};
  const currentEvents = state.events.filter((event) => event.playerId === state.currentPlayerId && event.type === "bid");
  const latestByTeam = new Map<string, AuctionEvent>();
  currentEvents.forEach((event) => {
    const team = FRANCHISES.find((candidate) => eventActorMatches(event.actor, candidate, state.userFranchiseId));
    if (team) latestByTeam.set(team.id, event);
  });
  const leader = state.highestBidder;

  return FRANCHISES.map((team) => {
    const raw = rawStates[team.id] ?? {};
    const latest = latestByTeam.get(team.id);
    const budget = team.id === state.userFranchiseId ? state.userBudget : safeNumber(state.aiBudgets[team.id], state.ruleSet.auction.startingPurse);
    const squadSize = team.id === state.userFranchiseId ? state.userSquad.length : (state.aiSquads[team.id] ?? []).length;
    const isLeader = leader === team.id || leader === team.shortName || (team.id === state.userFranchiseId && leader === "YOU");
    // The engine keeps the user in the same bidder-state map as the rivals so
    // it can enforce lot-level invariants. That internal state starts at
    // `ELIGIBLE`, but the presentation contract needs an explicit `YOU`
    // status until the user is leading, folded, or has just won a lot.
    const inferredStatus: BidderUiStatus = isLeader
      ? "LEADING"
      : team.id === state.userFranchiseId
        ? raw.status === "FOLDED" || raw.status === "WON" ? raw.status : "YOU"
        : raw.status ?? (latest ? "BIDDING" : "WATCHING");
    const lastBid = safeNumber(raw.lastBid, latest?.price ?? NaN);
    return {
      team,
      status: inferredStatus,
      budget,
      squadSize,
      lastBid: Number.isFinite(lastBid) ? lastBid : null,
      bidCount: safeNumber(raw.decisionCount, currentEvents.filter((event) => eventActorMatches(event.actor, team, state.userFranchiseId)).length),
      maxBid: typeof raw.maxBid === "number" && Number.isFinite(raw.maxBid) ? raw.maxBid : null,
      psychology: raw.psychology,
      needScore: raw.needScore,
      alternativeCount: raw.alternativeCount,
      reason: raw.reason
    };
  });
}

export function peerActivityFor(state: AuctionState) {
  const source = extended(state);
  if (source.peerActivity?.length) return [...source.peerActivity].reverse();
  // Legacy saves only contain events. Turn those into a compact, honest
  // activity feed instead of inventing rival decisions.
  return state.events
    .filter((event) => event.playerId === state.currentPlayerId && event.type === "bid" && event.actor !== "YOU")
    .slice(-8)
    .reverse()
    .map((event, index) => ({
      id: event.id || `legacy-peer-${index}`,
      teamId: event.actor ?? "UNKNOWN",
      status: "BID" as const,
      bid: event.price ?? null,
      reason: event.text,
      round: state.round
    }));
}

export function currentPlayerFor(state: AuctionState) {
  return activePlayersForState(state).find((player) => player.playerId === state.currentPlayerId);
}

export function eventCountForCurrent(state: AuctionState) {
  return state.events.filter((event) => event.playerId === state.currentPlayerId && event.type === "bid").length;
}

export function marketRoundFor(state: AuctionState) { return extended(state).marketRound ?? state.round; }
