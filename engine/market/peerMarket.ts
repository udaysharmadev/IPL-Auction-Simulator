import type { Player } from "@/data/players/types";
import { FRANCHISE_MARKET_PROFILES } from "@/data/teams/marketProfiles";
import type { Franchise, FranchiseId } from "@/data/teams/franchises";
import type { Difficulty } from "@/domain/onboarding";
import { decideAiBid, type AiBidDecision, type AiPsychology } from "@/engine/ai/aiBidder";
import { aiDifficultyProfile } from "@/engine/ai/difficulty";
import { createNamedRng } from "@/engine/random/seededRng";
import { canAddPlayer, minimumCompletionReserve, type SquadRulesConfig } from "@/engine/squad/squadRules";

export type BidderStatus = "ELIGIBLE" | "BIDDING" | "LEADING" | "FOLDED" | "BUDGET_LOCKED" | "SQUAD_LOCKED" | "WON";
export type PeerActivityStatus = "BID" | "WATCHING" | "FOLD" | "INELIGIBLE";

export type AiBidderState = {
  teamId: string;
  status: BidderStatus;
  maxBid: number;
  lastBid: number;
  decisionCount: number;
  psychology: AiPsychology;
  needScore: number;
  alternativeCount: number;
  reason: string;
};

export type PeerBidActivity = {
  id: string;
  teamId: string;
  status: PeerActivityStatus;
  bid: number | null;
  maxBid: number;
  psychology: AiPsychology;
  needScore: number;
  alternativeCount: number;
  reason: string;
  round: number;
};

export type PeerMarketContext = {
  seed: string;
  lotIndex: number;
  round: number;
  userFranchiseId: string;
  currentLeaderId: string | null;
  currentBid: number;
  nextPrice: number;
  player: Player;
  players: readonly Player[];
  remainingPlayers: readonly Player[];
  franchises: readonly Franchise[];
  budgets: Readonly<Record<string, number>>;
  squads: Readonly<Record<string, readonly string[]>>;
  rules: SquadRulesConfig;
  bidIncrementBands: readonly { below: number; increment: number }[];
  difficulty?: Difficulty;
  previousStates?: Readonly<Record<string, AiBidderState>>;
};

export type PeerMarketResult = {
  bidderStates: Record<string, AiBidderState>;
  activity: PeerBidActivity[];
  selected: { team: Franchise; decision: AiBidDecision } | null;
  eligibleCount: number;
};

type EvaluatedTeam = {
  team: Franchise;
  decision: AiBidDecision | null;
  activity: PeerBidActivity;
  initiative: number;
};

export function createBidderStates(franchises: readonly Franchise[]): Record<string, AiBidderState> {
  return Object.fromEntries(franchises.map((team) => [team.id, emptyBidderState(team.id)]));
}

/**
 * Evaluates every rival table for one market round. The function is pure:
 * named RNG scopes depend only on seed, lot, round and franchise.
 */
export function evaluatePeerMarket(context: PeerMarketContext): PeerMarketResult {
  const bidderStates = cloneStates(context.franchises, context.previousStates);
  normalizeLeaderStates(bidderStates, context.currentLeaderId);
  const rivalTeams = context.franchises.filter((team) => team.id !== context.userFranchiseId);
  const preliminarilyEligible = rivalTeams.filter((team) => {
    const previous = bidderStates[team.id];
    if (team.id === context.currentLeaderId || isTerminalForLot(previous.status)) return false;
    const budget = context.budgets[team.id] ?? 0;
    const squad = context.squads[team.id] ?? [];
    return budget >= context.nextPrice && canAddPlayer(squad, context.player, context.rules, context.players);
  });
  const candidateCount = preliminarilyEligible.length;

  const evaluations = rivalTeams.map((team): EvaluatedTeam => evaluateTeam(context, team, bidderStates, candidateCount));
  const contenders = evaluations
    .filter((evaluation): evaluation is EvaluatedTeam & { decision: AiBidDecision } => Boolean(evaluation.decision?.shouldBid))
    .sort((left, right) => right.initiative - left.initiative || right.decision.maxBid - left.decision.maxBid || left.team.id.localeCompare(right.team.id));
  const selected = contenders[0] ?? null;

  if (selected) {
    normalizeLeaderStates(bidderStates, selected.team.id);
    const selectedState = bidderStates[selected.team.id];
    bidderStates[selected.team.id] = { ...selectedState, status: "LEADING", lastBid: selected.decision.bid };
    selected.activity.status = "BID";
    selected.activity.bid = selected.decision.bid;
    selected.activity.reason = `${selected.team.shortName} raises to ${formatCr(selected.decision.bid)} with ${formatCr(selected.decision.maxBid)} model headroom.`;
  }

  return {
    bidderStates,
    activity: evaluations.map((evaluation) => evaluation.activity),
    selected: selected ? { team: selected.team, decision: selected.decision } : null,
    eligibleCount: contenders.length
  };
}

function evaluateTeam(
  context: PeerMarketContext,
  team: Franchise,
  bidderStates: Record<string, AiBidderState>,
  candidateCount: number
): EvaluatedTeam {
  const previous = bidderStates[team.id] ?? emptyBidderState(team.id);
  const activityBase = { lotIndex: context.lotIndex, round: context.round, teamId: team.id };

  if (team.id === context.currentLeaderId) {
    const leading = { ...previous, status: "LEADING" as const };
    bidderStates[team.id] = leading;
    return { team, decision: null, initiative: Number.NEGATIVE_INFINITY, activity: activityFrom(leading, activityBase, "WATCHING", null, "Current high bidder is waiting for a counter.") };
  }
  if (previous.status === "FOLDED") {
    return { team, decision: null, initiative: Number.NEGATIVE_INFINITY, activity: activityFrom(previous, activityBase, "FOLD", null, previous.reason) };
  }
  if (previous.status === "SQUAD_LOCKED" || previous.status === "BUDGET_LOCKED" || previous.status === "WON") {
    return { team, decision: null, initiative: Number.NEGATIVE_INFINITY, activity: activityFrom(previous, activityBase, "INELIGIBLE", null, previous.reason) };
  }

  const teamId = team.id as FranchiseId;
  // Custom/expansion teams use the neutral KKR profile until a dedicated
  // strategy pack is supplied; the market must never crash on a valid roster.
  const strategy = FRANCHISE_MARKET_PROFILES[teamId] ?? FRANCHISE_MARKET_PROFILES.KKR;
  const budget = context.budgets[team.id] ?? 0;
  const squad = context.squads[team.id] ?? [];
  if (!canAddPlayer(squad, context.player, context.rules, context.players)) {
    const locked = updateState(previous, "SQUAD_LOCKED", "Squad composition rules block this purchase.");
    bidderStates[team.id] = locked;
    return { team, decision: null, initiative: Number.NEGATIVE_INFINITY, activity: activityFrom(locked, activityBase, "INELIGIBLE", null, locked.reason) };
  }

  const reserve = minimumCompletionReserve(squad, context.player, context.remainingPlayers, context.rules, context.players);
  const openSlotsAfterPurchase = Math.max(0, context.rules.minSquadSize - squad.length - 1);
  const reserveRequired = reserve + openSlotsAfterPurchase * strategy.reservePerOpenSlot;
  if (!Number.isFinite(reserveRequired) || budget - reserveRequired < context.nextPrice) {
    const locked = updateState(previous, "BUDGET_LOCKED", "Purse reserve is protected for minimum squad completion.");
    bidderStates[team.id] = locked;
    return { team, decision: null, initiative: Number.NEGATIVE_INFINITY, activity: activityFrom(locked, activityBase, "INELIGIBLE", null, locked.reason) };
  }

  const decision = decideAiBid({
    player: context.player,
    squad,
    budget,
    reserveRequired,
    remainingPlayers: context.remainingPlayers,
    players: context.players,
    currentBid: context.currentBid,
    candidates: Math.max(1, candidateCount),
    rules: context.rules,
    bidIncrementBands: context.bidIncrementBands,
    difficulty: aiDifficultyProfile(context.difficulty),
    strategy,
    rng: createNamedRng(context.seed, "ai-decisions", `${context.lotIndex}/round-${context.round}/${team.id}`)
  });
  const alternativeCount = Math.max(0, candidateCount - 1);
  const state: AiBidderState = {
    teamId: team.id,
    status: decision.shouldBid ? "BIDDING" : "FOLDED",
    maxBid: decision.maxBid,
    lastBid: previous.lastBid,
    decisionCount: previous.decisionCount + 1,
    psychology: decision.psychology,
    needScore: decision.valuation.needScore,
    alternativeCount,
    reason: decision.valuation.reason
  };
  bidderStates[team.id] = state;
  if (!decision.shouldBid) {
    return { team, decision, initiative: Number.NEGATIVE_INFINITY, activity: activityFrom(state, activityBase, "FOLD", null, `${team.shortName} withdraws at ${formatCr(context.nextPrice)}; model ceiling ${formatCr(decision.maxBid)}.`) };
  }

  const initiativeRng = createNamedRng(context.seed, "market-initiative", `${context.lotIndex}/round-${context.round}/${team.id}`);
  const difficulty = aiDifficultyProfile(context.difficulty);
  const headroom = Math.max(0, decision.maxBid - context.nextPrice);
  const initiative = headroom
    + decision.valuation.needScore * 0.22 * difficulty.needAwareness
    + strategy.aggression * 0.4
    + initiativeRng.next() * (0.7 + strategy.volatility * 4) * difficulty.initiativeNoise;
  return { team, decision, initiative, activity: activityFrom(state, activityBase, "WATCHING", null, `${team.shortName} remains live up to ${formatCr(decision.maxBid)}.`) };
}

function emptyBidderState(teamId: string): AiBidderState {
  return { teamId, status: "ELIGIBLE", maxBid: 0, lastBid: 0, decisionCount: 0, psychology: "CALM", needScore: 0, alternativeCount: 0, reason: "Awaiting market evaluation." };
}

function cloneStates(franchises: readonly Franchise[], source?: Readonly<Record<string, AiBidderState>>): Record<string, AiBidderState> {
  return Object.fromEntries(franchises.map((team) => [team.id, { ...(source?.[team.id] ?? emptyBidderState(team.id)) }]));
}

function normalizeLeaderStates(states: Record<string, AiBidderState>, leaderId: string | null): void {
  Object.entries(states).forEach(([teamId, bidder]) => {
    if (bidder.status !== "LEADING" || teamId === leaderId) return;
    states[teamId] = { ...bidder, status: "BIDDING" };
  });
}

function isTerminalForLot(status: BidderStatus): boolean {
  return status === "FOLDED" || status === "BUDGET_LOCKED" || status === "SQUAD_LOCKED" || status === "WON";
}

function updateState(previous: AiBidderState, status: BidderStatus, reason: string): AiBidderState {
  return { ...previous, status, decisionCount: previous.decisionCount + 1, reason };
}

function activityFrom(
  bidder: AiBidderState,
  key: { lotIndex: number; round: number; teamId: string },
  status: PeerActivityStatus,
  bid: number | null,
  reason: string
): PeerBidActivity {
  return {
    id: `${key.lotIndex}-market-${key.round}-${key.teamId}`,
    teamId: key.teamId,
    status,
    bid,
    maxBid: bidder.maxBid,
    psychology: bidder.psychology,
    needScore: bidder.needScore,
    alternativeCount: bidder.alternativeCount,
    reason,
    round: key.round
  };
}

function formatCr(value: number) {
  return `₹${value.toFixed(value % 1 === 0 ? 0 : 2)} Cr`;
}
