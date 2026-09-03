import { PLAYERS_2027 } from "@/data/players/2027";
import type { AuctionCategory, Player, Role } from "@/data/players/types";
import { FRANCHISES_2027 } from "@/data/teams/franchises";
import { RULE_SET_SNAPSHOT } from "@/data/rules";
import type { AuctionFormat, Difficulty, GraphicsQuality } from "@/domain/onboarding";
import type { RuleSetSnapshot } from "@/domain/rules";
import type { AiPsychology } from "@/engine/ai/aiBidder";
import { categoryForPlayer, categoryRoundAt, generateAuctionOrder } from "@/engine/auction/orderGenerator";
import { createBidderStates, evaluatePeerMarket, type AiBidderState, type PeerBidActivity } from "@/engine/market/peerMarket";
import { createNamedRng } from "@/engine/random/seededRng";
import { buildRoleNeeds, canAddPlayer, minimumCompletionReserve, type SquadRulesConfig } from "@/engine/squad/squadRules";

export type { AiBidderState, BidderStatus, PeerActivityStatus, PeerBidActivity } from "@/engine/market/peerMarket";

export type AuctionPhase = "INTRO" | "PLAYER_PRESENTATION" | "FIRST_BID" | "BIDDING" | "FINAL_CALL" | "SOLD" | "PASSED" | "COMPLETE";
export type SquadNeed = { role: Role; label: string; count: number; priority: "A" | "B" };
export type AiDecisionTrace = { team: string; maxBid: number; needScore: number; alternativeCount: number; psychology: AiPsychology; reason: string };
export type AuctionEvent = { id: string; text: string; type: "bid" | "sold" | "pass" | "system" | "warning"; playerId?: string; price?: number; actor?: string };
export type AuctionState = {
  seed: string;
  userFranchiseId: string;
  phase: AuctionPhase;
  round: number;
  /** Compatibility display field; contains the category code. */
  category: string;
  auctionCategory: AuctionCategory;
  currentIndex: number;
  currentPlayerId: string;
  currentBid: number;
  highestBidder: string | null;
  userBudget: number;
  userSquad: string[];
  aiBudgets: Record<string, number>;
  aiSquads: Record<string, string[]>;
  needs: SquadNeed[];
  order: string[];
  remainingPlayers: number;
  message: string;
  events: AuctionEvent[];
  soundOn: boolean;
  completed: boolean;
  userMaxBid: number | null;
  smartMaxEnabled: boolean;
  tension: number;
  aiTrace: AiDecisionTrace | null;
  rulesVersion: string;
  dataVersion: string;
  simulationModelVersion: string;
  /** Immutable configuration snapshot used for every transition and replay. */
  ruleSet: RuleSetSnapshot;
  /** Current-lot state for every table. Optional only for legacy saves. */
  bidderStates?: Record<string, AiBidderState>;
  /** Full current-lot rival decision trace, including folds and ineligible teams. */
  peerActivity?: PeerBidActivity[];
  /** Peer evaluation round for the current player lot. */
  marketRound?: number;
  /** Resolved session pool. Optional only for legacy saves. */
  playerPoolIds?: string[];
  /** Rival decision quality. It never changes purse or squad legality. */
  difficulty?: Difficulty;
  /** Optional replay metadata resolved from the setup flow. */
  format?: AuctionFormat;
  graphicsQuality?: GraphicsQuality;
  poolLabel?: string;
};

const players = PLAYERS_2027;
const franchises = FRANCHISES_2027;
const playerById = new Map(players.map((player) => [player.playerId, player]));
const squadRulesFor = (ruleSet: RuleSetSnapshot): SquadRulesConfig => ({ maxSquadSize: ruleSet.auction.maxSquadSize, minSquadSize: ruleSet.auction.minSquadSize, maxOverseas: ruleSet.auction.maxOverseas });
const defaultRules = squadRulesFor(RULE_SET_SNAPSHOT);
const MAX_AUTOMATED_MARKET_ROUNDS = 256;

export const bidIncrement = (bid: number, ruleSet: RuleSetSnapshot = RULE_SET_SNAPSHOT) => {
  const safeBid = Number.isFinite(bid) && bid >= 0 ? bid : 0;
  return ruleSet.auction.bidIncrementBands.find((band) => safeBid < band.below)?.increment ?? 1;
};
export const nextBid = (bid: number, ruleSet: RuleSetSnapshot = RULE_SET_SNAPSHOT) => {
  const safeBid = Number.isFinite(bid) && bid >= 0 ? bid : 0;
  return Number((safeBid + bidIncrement(safeBid, ruleSet)).toFixed(2));
};

export function createAuction(
  userFranchiseId = "KKR",
  seed = "2027-AUCTION-847293",
  activeRules: RuleSetSnapshot = RULE_SET_SNAPSHOT,
  activePlayers: readonly Player[] = PLAYERS_2027,
  difficulty: Difficulty = "STRATEGIST",
  setupMeta: Partial<Pick<AuctionState, "format" | "graphicsQuality" | "poolLabel">> = {}
): AuctionState {
  if (!franchises.some((team) => team.id === userFranchiseId)) throw new Error(`Unknown franchise: ${userFranchiseId}`);
  const resolvedPlayers = resolvePlayerPool(activePlayers);
  const order = generateAuctionOrder(resolvedPlayers, createNamedRng(seed, "auction-order"), activeRules.auction.categoryOrder);
  const firstPlayer = resolvedPlayers.find((player) => player.playerId === order[0]);
  if (!firstPlayer) throw new Error("Cannot create an auction without players");
  const aiBudgets = Object.fromEntries(franchises.filter((team) => team.id !== userFranchiseId).map((team) => [team.id, activeRules.auction.startingPurse]));
  const activeRulesConfig = squadRulesFor(activeRules);
  const bidderStates = createBidderStates(franchises);
  return {
    seed, userFranchiseId, phase: "FIRST_BID", round: 1, category: categoryForPlayer(firstPlayer), auctionCategory: categoryForPlayer(firstPlayer), currentIndex: 0,
    currentPlayerId: firstPlayer.playerId, currentBid: 0, highestBidder: null, userBudget: activeRules.auction.startingPurse, userSquad: [], aiBudgets,
    aiSquads: Object.fromEntries(Object.keys(aiBudgets).map((id) => [id, []])), needs: buildNeeds([], resolvedPlayers, activeRulesConfig), order,
    remainingPlayers: order.length, message: "We start at the base price. Any interest?", events: [{ id: "intro", text: "Auction room opened", type: "system" }], soundOn: true,
    completed: false, userMaxBid: null, smartMaxEnabled: false, tension: 18, aiTrace: null, rulesVersion: activeRules.version,
    dataVersion: activeRules.dataVersion, simulationModelVersion: activeRules.simulationModelVersion, ruleSet: activeRules,
    bidderStates, peerActivity: [], marketRound: 0, playerPoolIds: order, difficulty, ...setupMeta
  };
}

export function buildNeeds(squad: readonly string[], pool: readonly Player[] = players, squadRules: SquadRulesConfig = defaultRules): SquadNeed[] { return buildRoleNeeds(squad, pool, squadRules); }

export function processUserBid(state: AuctionState, requestedIncrement?: number): AuctionState {
  if (!["FIRST_BID", "BIDDING", "FINAL_CALL"].includes(state.phase)) return state;
  if (isUserLeader(state)) return { ...state, message: "You already hold the highest bid. Wait for another table to counter." };
  if (state.bidderStates?.[state.userFranchiseId]?.status === "FOLDED") return { ...state, message: "You have passed on this lot; the table cannot re-enter." };
  const player = currentPlayer(state); if (!player) return { ...state, message: "The active player is unavailable in this dataset." };
  const stateRuleSet = state.ruleSet ?? RULE_SET_SNAPSHOT;
  if (!Number.isFinite(state.currentBid) || state.currentBid < 0 || !Number.isFinite(state.userBudget) || state.userBudget < 0) {
    return { ...state, message: "Auction state is invalid; this bid was rejected." };
  }
  const legalIncrement = bidIncrement(state.currentBid, stateRuleSet);
  if (requestedIncrement !== undefined && (!Number.isFinite(requestedIncrement) || requestedIncrement < 0)) {
    return { ...state, message: "Enter a valid bid increment." };
  }
  const increment = requestedIncrement === undefined ? legalIncrement : Math.max(legalIncrement, requestedIncrement);
  const price = state.currentBid === 0 ? Number(player.auctionData.basePrice.toFixed(2)) : Number((state.currentBid + increment).toFixed(2));
  if (!Number.isFinite(price) || price <= state.currentBid) return { ...state, message: "That bid is not a valid increase." };
  if (state.smartMaxEnabled && state.userMaxBid !== null && (!Number.isFinite(state.userMaxBid) || price > state.userMaxBid)) {
    return { ...state, message: `Smart Max protected your ceiling at ${Number.isFinite(state.userMaxBid) ? formatCr(state.userMaxBid) : "the configured maximum"}.` };
  }
  const stateRules = squadRulesFor(stateRuleSet);
  const statePlayers = playersForState(state);
  if (!canAddPlayer(state.userSquad, player, stateRules, statePlayers)) return { ...state, message: "Squad rules prevent this purchase." };
  const statePlayerById = new Map(statePlayers.map((candidate) => [candidate.playerId, candidate]));
  const remainingPlayers = state.order.slice(state.currentIndex + 1).map((id) => statePlayerById.get(id)).filter((candidate): candidate is Player => Boolean(candidate));
  const reserveRequired = minimumCompletionReserve(state.userSquad, player, remainingPlayers, stateRules, statePlayers);
  if (price > state.userBudget || !Number.isFinite(reserveRequired) || price + reserveRequired > state.userBudget) return { ...state, message: price > state.userBudget ? "Purse discipline: that bid is above your available budget." : "Purse discipline: reserve enough to complete the minimum squad." };
  const event: AuctionEvent = { id: `${state.currentIndex}-${state.events.length}`, text: `You bid ${formatCr(price)} for ${player.identity.shortName}`, type: "bid", playerId: player.playerId, price, actor: "YOU" };
  const bidderStates = cloneBidderStates(state);
  demoteOtherLeaders(bidderStates, state.userFranchiseId);
  const userState = bidderStates[state.userFranchiseId] ?? emptyBidderState(state.userFranchiseId);
  bidderStates[state.userFranchiseId] = { ...userState, status: "LEADING", lastBid: price, decisionCount: userState.decisionCount + 1, reason: "User bid accepted." };
  return { ...state, currentBid: price, highestBidder: "YOU", phase: "BIDDING", tension: Math.min(100, state.tension + 11), message: `You are in at ${formatCr(price)}. The room is watching.`, events: [...state.events, event], bidderStates };
}

export function processPass(state: AuctionState): AuctionState {
  if (!["FIRST_BID", "BIDDING", "FINAL_CALL"].includes(state.phase)) return state;
  const bidderStates = cloneBidderStates(state);
  const userState = bidderStates[state.userFranchiseId] ?? emptyBidderState(state.userFranchiseId);
  if (userState.status === "FOLDED") return { ...state, message: "You are already out on this lot; the remaining tables are resolving it." };
  bidderStates[state.userFranchiseId] = { ...userState, status: "FOLDED", reason: state.highestBidder === "YOU" ? "No further user counterbids; the current leading offer remains live." : "User passed on this lot." };
  const nextState = { ...state, bidderStates, phase: "BIDDING" as const, message: "You are out. The remaining tables will resolve the lot." };
  if (state.highestBidder && !isUserBidder(state, state.highestBidder)) {
    const leaderId = resolveBidderId(state.highestBidder, state.userFranchiseId);
    if (!leaderId || bidderStates[leaderId]?.status !== "LEADING") return settleCurrent(nextState, state.highestBidder);
  }
  // A pass is an observable command: let exactly one rival market round (or
  // the final settlement) happen so the room can show each table's response.
  return state.phase === "FINAL_CALL" ? settleCurrent(nextState, state.highestBidder) : runAiTurn(nextState);
}

export function advanceAuction(state: AuctionState): AuctionState {
  if (state.phase === "PLAYER_PRESENTATION") return { ...state, phase: "FIRST_BID", message: `We start at ${formatCr(currentPlayer(state)?.auctionData.basePrice ?? 1)} Crore. Any interest?` };
  if (state.phase === "FIRST_BID") return runAiTurn(state);
  if (state.phase === "BIDDING") return runAiTurn(state);
  if (state.phase === "FINAL_CALL") return settleCurrent(state, state.highestBidder);
  if (state.phase === "SOLD" || state.phase === "PASSED") return moveToNext(state);
  return state;
}

/** Compatibility helper for callers that want to let the machine finish a lot. */
export function resolveAuctionLot(state: AuctionState): AuctionState {
  return drainAutomatedMarket(state);
}

export function runAiTurn(state: AuctionState): AuctionState {
  const player = currentPlayer(state); if (!player) return state;
  // Live UI pacing calls this one round at a time, whereas headless runs use
  // `drainAutomatedMarket`. Keep both paths inside the persisted-state limit
  // so a pathological/stale market can never produce an unsaveable snapshot.
  if ((state.marketRound ?? 0) >= MAX_AUTOMATED_MARKET_ROUNDS) {
    return settleCurrent({ ...state, message: `Market round limit reached at ${formatCr(state.currentBid)}.` }, state.highestBidder);
  }
  const stateRuleSet = state.ruleSet ?? RULE_SET_SNAPSHOT;
  const openingPrice = state.currentBid === 0 ? player.auctionData.basePrice : nextBid(state.currentBid, stateRuleSet);
  const stateRules = squadRulesFor(stateRuleSet);
  const round = (state.marketRound ?? 0) + 1;
  const statePlayers = playersForState(state);
  const statePlayerById = new Map(statePlayers.map((candidate) => [candidate.playerId, candidate]));
  const remainingPlayers = state.order.slice(state.currentIndex).map((id) => statePlayerById.get(id)).filter((candidate): candidate is Player => Boolean(candidate));
  const currentLeaderId = resolveBidderId(state.highestBidder, state.userFranchiseId);
  const result = evaluatePeerMarket({
    seed: state.seed,
    lotIndex: state.currentIndex,
    round,
    userFranchiseId: state.userFranchiseId,
    currentLeaderId,
    currentBid: state.currentBid,
    nextPrice: openingPrice,
    player,
    players: statePlayers,
    remainingPlayers,
    franchises,
    budgets: state.aiBudgets,
    squads: state.aiSquads,
    rules: stateRules,
    bidIncrementBands: stateRuleSet.auction.bidIncrementBands,
    difficulty: state.difficulty,
    previousStates: state.bidderStates
  });
  const peerActivity = [...(state.peerActivity ?? []), ...result.activity];
  const baseState = { ...state, bidderStates: result.bidderStates, peerActivity, marketRound: round };
  const selected = result.selected;
  if (!selected) return state.highestBidder ? { ...baseState, phase: "FINAL_CALL", message: `The room hesitates at ${formatCr(state.currentBid)}. Final call.` } : settleCurrent(baseState, null);
  const { team, decision } = selected; const price = decision.bid;
  const event: AuctionEvent = { id: `${state.currentIndex}-${state.events.length}`, text: `${team.shortName} enters at ${formatCr(price)}`, type: "bid", playerId: player.playerId, price, actor: team.id };
  return { ...baseState, currentBid: price, highestBidder: team.id, phase: "BIDDING", tension: Math.min(100, state.tension + 8), aiTrace: { team: team.shortName, maxBid: decision.maxBid, needScore: decision.valuation.needScore, alternativeCount: Math.max(0, result.eligibleCount - 1), psychology: decision.psychology, reason: `${team.shortName} values ${player.identity.shortName} at ${formatCr(decision.maxBid)} because ${decision.valuation.reason}` }, message: `${team.shortName} is in the mix at ${formatCr(price)}.`, events: [...state.events, event] };
}

function settleCurrent(state: AuctionState, bidder: string | null): AuctionState {
  const player = currentPlayer(state); if (!player) return state;
  if (!bidder) return { ...state, phase: "PASSED", tension: Math.max(10, state.tension - 15), message: `${player.identity.shortName} goes unsold. The market moves on.`, events: [...state.events, { id: `${state.currentIndex}-pass`, text: `${player.identity.shortName} goes unsold`, type: "pass", playerId: player.playerId }] };
  const ownerId = resolveBidderId(bidder, state.userFranchiseId);
  if (!ownerId) return voidInvalidLot(state, player, "invalid-leader", "The market leader was invalid; the lot was voided safely.");
  const isUser = isUserBidder(state, bidder); const owner = isUser ? state.userFranchiseId : ownerId;
  if (state.userSquad.includes(player.playerId) || Object.values(state.aiSquads).some((squad) => squad.includes(player.playerId))) {
    return voidInvalidLot(state, player, "duplicate-player", `${player.identity.shortName} was already assigned; duplicate ownership was prevented.`);
  }
  if (!Number.isFinite(state.currentBid) || state.currentBid <= 0) return voidInvalidLot(state, player, "invalid-price", "The lot had no valid price and was passed.");
  const squads = { ...state.aiSquads }; const budgets = { ...state.aiBudgets }; let userBudget = state.userBudget;
  if (!isUser && !(owner in budgets)) return voidInvalidLot(state, player, "unknown-owner", "The winning franchise was not present in this auction.");
  if ((isUser ? userBudget : budgets[owner]) < state.currentBid) return voidInvalidLot(state, player, "insufficient-purse", "The winning table no longer had enough purse; the lot was voided.");
  if (isUser) userBudget = Math.max(0, userBudget - state.currentBid); else budgets[owner] = Math.max(0, (budgets[owner] ?? 0) - state.currentBid);
  if (!isUser) squads[owner] = [...(squads[owner] ?? []), player.playerId];
  const userSquad = isUser ? [...state.userSquad, player.playerId] : state.userSquad;
  const stateRuleSet = state.ruleSet ?? RULE_SET_SNAPSHOT;
  const bidderStates = cloneBidderStates(state);
  if (bidderStates[owner]) bidderStates[owner] = { ...bidderStates[owner], status: "WON", lastBid: state.currentBid };
  const winnerLabel = isUser ? "YOU" : owner;
  return { ...state, phase: "SOLD", userBudget, userSquad, aiBudgets: budgets, aiSquads: squads, needs: buildNeeds(userSquad, playersForState(state), squadRulesFor(stateRuleSet)), tension: Math.min(100, state.tension + (state.currentBid > player.valuation.fairValue * 1.25 ? 15 : 7)), message: `${player.identity.shortName} sold to ${winnerLabel} for ${formatCr(state.currentBid)}.`, events: [...state.events, { id: `${state.currentIndex}-sold`, text: `${player.identity.shortName} sold to ${winnerLabel} for ${formatCr(state.currentBid)}`, type: "sold", playerId: player.playerId, price: state.currentBid, actor: owner }], bidderStates };
}

function moveToNext(state: AuctionState): AuctionState {
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.order.length) return { ...state, phase: "COMPLETE", completed: true, remainingPlayers: 0, message: "Auction complete. Your squad report is ready." };
  const statePlayers = playersForState(state);
  const nextPlayer = statePlayers.find((player) => player.playerId === state.order[nextIndex]); if (!nextPlayer) return { ...state, phase: "COMPLETE", completed: true, remainingPlayers: 0, message: "Auction complete. Your squad report is ready." };
  const auctionCategory = categoryForPlayer(nextPlayer);
  return { ...state, phase: "PLAYER_PRESENTATION", currentIndex: nextIndex, currentPlayerId: nextPlayer.playerId, currentBid: 0, highestBidder: null, category: auctionCategory, auctionCategory, remainingPlayers: state.order.length - nextIndex, round: categoryRoundAt(state.order, nextIndex, statePlayers), userMaxBid: null, smartMaxEnabled: false, tension: Math.max(15, state.tension - 22), aiTrace: null, message: `${nextPlayer.identity.shortName} is walking into the room.`, bidderStates: createBidderStates(franchises), peerActivity: [], marketRound: 0 };
}

function resolveAutomatedMarket(state: AuctionState): AuctionState {
  // A legacy/manual snapshot can carry a rival leader without the peer
  // market's authoritative bidder state. Treat that leader as already
  // resolved; live peer turns always mark the leader explicitly and continue
  // evaluating the remaining tables below.
  if (state.highestBidder && state.highestBidder !== "YOU") {
    const leaderId = resolveBidderId(state.highestBidder, state.userFranchiseId);
    const leaderState = leaderId ? state.bidderStates?.[leaderId] : undefined;
    if (!leaderState || leaderState.status !== "LEADING") return settleCurrent(state, state.highestBidder);
  }
  let current = state;
  for (let index = 0; index < MAX_AUTOMATED_MARKET_ROUNDS; index += 1) {
    if (current.phase === "FINAL_CALL") return settleCurrent(current, current.highestBidder);
    if (current.phase === "SOLD" || current.phase === "PASSED" || current.phase === "COMPLETE") return current;
    current = runAiTurn(current);
  }
  return settleCurrent({ ...current, message: `Market round limit reached at ${formatCr(current.currentBid)}.` }, current.highestBidder);
}

/**
 * Resolve the current lot without any UI pacing. This is intentionally kept
 * separate from `advanceAuction`, which advances exactly one observable market
 * turn. It is useful for headless simulations, exports and deterministic
 * tests that do not need to render each rival response.
 */
export function drainAutomatedMarket(state: AuctionState): AuctionState {
  return resolveAutomatedMarket(state);
}

function emptyBidderState(teamId: string): AiBidderState {
  return { teamId, status: "ELIGIBLE", maxBid: 0, lastBid: 0, decisionCount: 0, psychology: "CALM", needScore: 0, alternativeCount: 0, reason: "Awaiting market evaluation." };
}

function cloneBidderStates(state: AuctionState): Record<string, AiBidderState> {
  const source = state.bidderStates ?? createBidderStates(franchises);
  return Object.fromEntries(franchises.map((team) => [team.id, { ...(source[team.id] ?? emptyBidderState(team.id)) }])) as Record<string, AiBidderState>;
}

export function resolveBidderId(bidder: string | null, userFranchiseId: string): string | null {
  if (!bidder) return null;
  if (bidder === "YOU") return userFranchiseId;
  return franchises.find((team) => team.id === bidder || team.shortName === bidder)?.id ?? null;
}

function currentPlayer(state: AuctionState): Player | undefined {
  return playersForState(state).find((player) => player.playerId === state.currentPlayerId);
}
function formatCr(value: number) { return `₹${value.toFixed(value % 1 === 0 ? 0 : 2)} Cr`; }

export function gradeAuction(state: AuctionState) {
  const statePlayers = playersForState(state);
  const statePlayerById = new Map(statePlayers.map((player) => [player.playerId, player]));
  const acquired = state.userSquad.map((id) => statePlayerById.get(id)).filter((player): player is Player => Boolean(player));
  const quality = acquired.length ? acquired.reduce((sum, player) => sum + player.simulationData.overall, 0) / acquired.length : 0;
  const stateRuleSet = state.ruleSet ?? RULE_SET_SNAPSHOT;
  const needs = buildNeeds(state.userSquad, statePlayers, squadRulesFor(stateRuleSet)).reduce((sum, need) => sum + need.count, 0);
  const coverage = Math.max(0, 100 - needs * 5);
  const efficiency = acquired.length ? Math.round(acquired.reduce((sum, player) => sum + (player.valuation.fairValue / Math.max(0.25, state.events.find((event) => event.playerId === player.playerId && event.type === "sold")?.price ?? player.valuation.fairValue)) * 100, 0) / acquired.length) : 0;
  return { overall: Math.round(quality * 0.55 + coverage * 0.25 + efficiency * 0.2), quality: Math.round(quality), coverage, efficiency, grade: quality > 86 && coverage > 80 ? "A" : quality > 78 ? "B+" : "B" };
}

export function activePlayer(state: AuctionState) { return currentPlayer(state); }
/**
 * Return the canonical player pool for a session. The no-argument form is
 * retained for legacy callers, while a state argument keeps tooling and
 * exports aligned with Quick/Custom session pools.
 */
export function activePlayerPool(state?: AuctionState) {
  return state ? playersForState(state) : players;
}
export function auctionRulesSnapshot() { return RULE_SET_SNAPSHOT; }

function resolvePlayerPool(activePlayers: readonly Player[]): Player[] {
  const unique = new Map<string, Player>();
  activePlayers.forEach((player) => {
    if (player && typeof player.playerId === "string" && player.playerId.length > 0 && !unique.has(player.playerId)) unique.set(player.playerId, player);
  });
  if (unique.size === 0) throw new Error("Cannot create an auction without a player pool");
  return [...unique.values()];
}

function playersForState(state: AuctionState): Player[] {
  const ids = state.playerPoolIds;
  if (!ids?.length) return players;
  const resolved = ids.map((id) => playerById.get(id)).filter((player): player is Player => Boolean(player));
  return resolved.length > 0 ? resolved : players;
}

export function isUserBidder(state: Pick<AuctionState, "userFranchiseId">, bidder: string): boolean {
  return resolveBidderId(bidder, state.userFranchiseId) === state.userFranchiseId;
}

function isUserLeader(state: AuctionState): boolean {
  return Boolean(state.highestBidder && isUserBidder(state, state.highestBidder));
}

function demoteOtherLeaders(states: Record<string, AiBidderState>, leaderId: string): void {
  Object.entries(states).forEach(([teamId, bidder]) => {
    if (teamId !== leaderId && bidder.status === "LEADING") states[teamId] = { ...bidder, status: "BIDDING" };
  });
}

function voidInvalidLot(state: AuctionState, player: Player, code: string, message: string): AuctionState {
  return {
    ...state,
    phase: "PASSED",
    highestBidder: null,
    message,
    events: [...state.events, { id: `${state.currentIndex}-${code}`, text: message, type: "warning", playerId: player.playerId }]
  };
}
