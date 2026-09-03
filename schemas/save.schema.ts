import type { AuctionPhase, AuctionState } from "@/engine/auctionEngine";
import { AUCTION_CATEGORIES, PLAYER_ROLES, type Role } from "@/data/players/types";
import { FRANCHISES_2027, FRANCHISE_IDS } from "@/data/teams/franchises";
import { validateRuleSetSnapshot, type RuleSetSnapshot } from "@/domain/rules";
import type { AuctionFormat, Difficulty, GraphicsQuality } from "@/domain/onboarding";
import { PLAYER_BY_ID } from "@/data/players/2027";

export const AUCTION_SAVE_SCHEMA_VERSION = 1 as const;

export type AuctionSaveVersions = {
  rulesVersion: string;
  datasetVersion: string;
  simulationModelVersion: string;
};

export type AuctionSaveRecord = AuctionSaveVersions & {
  key: string;
  schemaVersion: typeof AUCTION_SAVE_SCHEMA_VERSION;
  savedAt: string;
  auction: AuctionState;
};

export type SaveParseResult =
  | { success: true; data: AuctionSaveRecord }
  | { success: false; error: string };

const AUCTION_PHASES: readonly AuctionPhase[] = [
  "INTRO",
  "PLAYER_PRESENTATION",
  "FIRST_BID",
  "BIDDING",
  "FINAL_CALL",
  "SOLD",
  "PASSED",
  "COMPLETE"
];
const BIDDER_STATUSES = ["ELIGIBLE", "BIDDING", "LEADING", "FOLDED", "BUDGET_LOCKED", "SQUAD_LOCKED", "WON"] as const;
const PEER_ACTIVITY_STATUSES = ["BID", "WATCHING", "FOLD", "INELIGIBLE"] as const;
const AI_PSYCHOLOGIES = ["CALM", "INTERESTED", "COMPETING", "AGGRESSIVE", "CONCERNED", "PANICKING"] as const;
const MAX_MARKET_ROUNDS = 256;
const AUCTION_FORMATS: readonly AuctionFormat[] = ["AUTHENTIC", "QUICK", "CUSTOM"];
const DIFFICULTIES: readonly Difficulty[] = ["ROOKIE", "STRATEGIST", "EXPERT", "GM"];
const GRAPHICS_QUALITIES: readonly GraphicsQuality[] = ["ULTRA", "HIGH", "BALANCED", "PERFORMANCE"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && PLAYER_ROLES.includes(value as Role);
}

function isFranchiseId(value: unknown): value is (typeof FRANCHISE_IDS)[number] {
  return typeof value === "string" && FRANCHISE_IDS.includes(value as (typeof FRANCHISE_IDS)[number]);
}

function isBoundedNumber(value: unknown, minimum: number, maximum: number): value is number {
  return isFiniteNumber(value) && value >= minimum && value <= maximum;
}

function isKnownFranchiseMap(value: unknown, valueValidator: (entry: unknown, teamId: string) => boolean): boolean {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([teamId, entry]) => isFranchiseId(teamId) && valueValidator(entry, teamId));
}

function isRivalFranchiseMap(value: unknown, userFranchiseId: string, valueValidator: (entry: unknown, teamId: string) => boolean): boolean {
  if (!isRecord(value)) return false;
  const expected = FRANCHISE_IDS.filter((teamId) => teamId !== userFranchiseId);
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((teamId) => teamId in value) && keys.every((teamId) => isFranchiseId(teamId) && valueValidator(value[teamId], teamId));
}

function isBidderStates(value: unknown, startingPurse: number): boolean {
  if (!isRecord(value) || Object.keys(value).length !== FRANCHISE_IDS.length || FRANCHISE_IDS.some((teamId) => !(teamId in value))) return false;
  return isKnownFranchiseMap(value, (entry, teamId) => {
    if (!isRecord(entry)) return false;
    return (
      entry.teamId === teamId &&
      BIDDER_STATUSES.includes(entry.status as (typeof BIDDER_STATUSES)[number]) &&
      isBoundedNumber(entry.maxBid, 0, startingPurse) &&
      isBoundedNumber(entry.lastBid, 0, startingPurse) &&
      isInteger(entry.decisionCount) && entry.decisionCount >= 0 && entry.decisionCount <= MAX_MARKET_ROUNDS + 1 &&
      AI_PSYCHOLOGIES.includes(entry.psychology as (typeof AI_PSYCHOLOGIES)[number]) &&
      isBoundedNumber(entry.needScore, 0, 100) &&
      isInteger(entry.alternativeCount) && entry.alternativeCount >= 0 && entry.alternativeCount < FRANCHISE_IDS.length &&
      typeof entry.reason === "string" && entry.reason.length > 0
    );
  });
}

function isPeerActivity(value: unknown, startingPurse: number, currentMarketRound?: number): boolean {
  if (!Array.isArray(value) || value.length > MAX_MARKET_ROUNDS * (FRANCHISE_IDS.length - 1)) return false;
  const ids = new Set<string>();
  return value.every((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string" || entry.id.length === 0 || ids.has(entry.id)) return false;
    ids.add(entry.id);
    return (
      isFranchiseId(entry.teamId) &&
      PEER_ACTIVITY_STATUSES.includes(entry.status as (typeof PEER_ACTIVITY_STATUSES)[number]) &&
      (entry.bid === null || isBoundedNumber(entry.bid, 0, startingPurse)) &&
      (entry.status === "BID" ? isBoundedNumber(entry.bid, 0, startingPurse) && entry.bid > 0 : entry.bid === null) &&
      isBoundedNumber(entry.maxBid, 0, startingPurse) &&
      AI_PSYCHOLOGIES.includes(entry.psychology as (typeof AI_PSYCHOLOGIES)[number]) &&
      isBoundedNumber(entry.needScore, 0, 100) &&
      isInteger(entry.alternativeCount) && entry.alternativeCount >= 0 && entry.alternativeCount < FRANCHISE_IDS.length &&
      typeof entry.reason === "string" && entry.reason.length > 0 &&
      isInteger(entry.round) && entry.round >= 0 && entry.round <= MAX_MARKET_ROUNDS &&
      (currentMarketRound === undefined || entry.round <= currentMarketRound)
    );
  });
}

function isAuctionEvent(value: unknown, order: readonly string[]): boolean {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0 || typeof value.text !== "string" || value.text.length === 0) return false;
  if (!["bid", "sold", "pass", "system", "warning"].includes(value.type as string)) return false;
  if (value.playerId !== undefined && (typeof value.playerId !== "string" || !order.includes(value.playerId))) return false;
  if (value.price !== undefined && (!isFiniteNumber(value.price) || value.price < 0)) return false;
  return value.actor === undefined || value.actor === "YOU" || isFranchiseId(value.actor) || FRANCHISES_2027.some((team) => team.shortName === value.actor);
}

function isOwnedPlayerList(value: unknown, activePlayerIds: ReadonlySet<string>): value is string[] {
  return isStringArray(value) && new Set(value).size === value.length && value.every((playerId) => activePlayerIds.has(playerId));
}

function isOptionalSessionMetadata(value: Record<string, unknown>, order: readonly string[]): boolean {
  if (value.playerPoolIds !== undefined && (!isStringArray(value.playerPoolIds) || value.playerPoolIds.length !== order.length || new Set(value.playerPoolIds).size !== value.playerPoolIds.length || value.playerPoolIds.some((playerId) => !order.includes(playerId)))) return false;
  if (value.difficulty !== undefined && !DIFFICULTIES.includes(value.difficulty as Difficulty)) return false;
  if (value.format !== undefined && !AUCTION_FORMATS.includes(value.format as AuctionFormat)) return false;
  if (value.graphicsQuality !== undefined && !GRAPHICS_QUALITIES.includes(value.graphicsQuality as GraphicsQuality)) return false;
  if (value.poolLabel !== undefined && (typeof value.poolLabel !== "string" || value.poolLabel.trim().length === 0 || value.poolLabel.length > 160)) return false;
  return true;
}

function isNeeds(value: unknown): boolean {
  return Array.isArray(value) && value.every((need) => {
    if (!isRecord(need)) return false;
    return isRole(need.role) && typeof need.label === "string" && need.label.length > 0 && isInteger(need.count) && need.count >= 0 && (need.priority === "A" || need.priority === "B");
  });
}

function isAiTrace(value: unknown, startingPurse: number): boolean {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return typeof value.team === "string" && value.team.length > 0 && isFiniteNumber(value.maxBid) && value.maxBid >= 0 && value.maxBid <= startingPurse && isFiniteNumber(value.needScore) && isInteger(value.alternativeCount) && value.alternativeCount >= 0 && ["CALM", "INTERESTED", "COMPETING", "AGGRESSIVE", "CONCERNED", "PANICKING"].includes(value.psychology as string) && typeof value.reason === "string" && value.reason.length > 0;
}

/**
 * Runtime validation at the persistence boundary. The domain engine remains
 * strongly typed, while corrupt or stale browser data is rejected safely.
 */
export function isAuctionState(value: unknown): value is AuctionState {
  if (!isRecord(value)) return false;

  const ruleSetErrors = validateRuleSetSnapshot(value.ruleSet);
  if (ruleSetErrors.length > 0) return false;
  const ruleSet = value.ruleSet as RuleSetSnapshot;
  const order = value.order;
  const currentPlayerId = value.currentPlayerId;
  const currentIndex = value.currentIndex;
  const startingPurse = ruleSet.auction.startingPurse;
  const validAiBudgets = isRivalFranchiseMap(value.aiBudgets, String(value.userFranchiseId), (entry) => isBoundedNumber(entry, 0, startingPurse));
  const activePlayerIds = new Set<string>(Array.isArray(order) ? order.filter((entry): entry is string => typeof entry === "string") : []);
  const validAiSquads = isRivalFranchiseMap(value.aiSquads, String(value.userFranchiseId), (entry) => isOwnedPlayerList(entry, activePlayerIds));
  const validMarketRound = value.marketRound === undefined || (isInteger(value.marketRound) && value.marketRound >= 0 && value.marketRound <= MAX_MARKET_ROUNDS);
  const marketRound = validMarketRound && typeof value.marketRound === "number" ? value.marketRound : undefined;
  const validBidderStates = value.bidderStates === undefined || isBidderStates(value.bidderStates, startingPurse);
  const validPeerActivity = value.peerActivity === undefined || isPeerActivity(value.peerActivity, startingPurse, marketRound);

  return (
    typeof value.seed === "string" &&
    value.seed.length > 0 &&
    isFranchiseId(value.userFranchiseId) &&
    AUCTION_PHASES.includes(value.phase as AuctionPhase) &&
    Number.isInteger(value.round) &&
    typeof value.category === "string" &&
    typeof value.auctionCategory === "string" &&
    Number.isInteger(currentIndex) &&
    Array.isArray(order) &&
    order.length > 0 &&
    isStringArray(order) &&
    new Set(order).size === order.length &&
    (currentIndex as number) >= 0 &&
    (currentIndex as number) < order.length &&
    typeof value.currentPlayerId === "string" &&
    order.includes(currentPlayerId as string) &&
    order.every((playerId) => typeof PLAYER_BY_ID[playerId] !== "undefined") &&
    isOwnedPlayerList(value.userSquad, activePlayerIds) &&
    isOptionalSessionMetadata(value, order as readonly string[]) &&
    AUCTION_CATEGORIES.includes(value.auctionCategory as (typeof AUCTION_CATEGORIES)[number]) &&
    isBoundedNumber(value.currentBid, 0, startingPurse) &&
    (value.highestBidder === null || value.highestBidder === "YOU" || isFranchiseId(value.highestBidder) || FRANCHISES_2027.some((team) => team.shortName === value.highestBidder)) &&
    isBoundedNumber(value.userBudget, 0, startingPurse) &&
    validAiBudgets &&
    validAiSquads &&
    isNeeds(value.needs) &&
    isInteger(value.remainingPlayers) &&
    value.remainingPlayers >= 0 &&
    value.remainingPlayers <= order.length &&
    typeof value.message === "string" &&
    Array.isArray(value.events) &&
    value.events.every((event) => isAuctionEvent(event, order)) &&
    typeof value.soundOn === "boolean" &&
    typeof value.completed === "boolean" &&
    (value.userMaxBid === null || isBoundedNumber(value.userMaxBid, 0, startingPurse)) &&
    typeof value.smartMaxEnabled === "boolean" &&
    isFiniteNumber(value.tension) &&
    value.tension >= 0 &&
    value.tension <= 100 &&
    (value.aiTrace === null || isRecord(value.aiTrace)) &&
    isAiTrace(value.aiTrace, startingPurse) &&
    validBidderStates &&
    validPeerActivity &&
    validMarketRound &&
    typeof value.rulesVersion === "string" &&
    value.rulesVersion === ruleSet.version &&
    typeof value.dataVersion === "string" &&
    value.dataVersion === ruleSet.dataVersion &&
    typeof value.simulationModelVersion === "string" &&
    value.simulationModelVersion === ruleSet.simulationModelVersion
  );
}

export function createAuctionSaveRecord(
  key: string,
  auction: AuctionState,
  versions: AuctionSaveVersions,
  savedAt = new Date().toISOString()
): AuctionSaveRecord {
  return {
    key,
    schemaVersion: AUCTION_SAVE_SCHEMA_VERSION,
    savedAt,
    ...versions,
    auction
  };
}

export function parseAuctionSaveRecord(value: unknown): SaveParseResult {
  if (!isRecord(value)) return { success: false, error: "Save is not an object." };
  if (value.schemaVersion !== AUCTION_SAVE_SCHEMA_VERSION) {
    return { success: false, error: `Unsupported save schema version: ${String(value.schemaVersion)}` };
  }
  if (typeof value.key !== "string" || value.key.length === 0) return { success: false, error: "Save key is missing." };
  if (typeof value.savedAt !== "string" || Number.isNaN(Date.parse(value.savedAt))) return { success: false, error: "Save timestamp is invalid." };
  if (typeof value.rulesVersion !== "string" || value.rulesVersion.length === 0) return { success: false, error: "Rules version is missing." };
  if (typeof value.datasetVersion !== "string" || value.datasetVersion.length === 0) return { success: false, error: "Dataset version is missing." };
  if (typeof value.simulationModelVersion !== "string" || value.simulationModelVersion.length === 0) return { success: false, error: "Simulation model version is missing." };
  if (!isAuctionState(value.auction)) return { success: false, error: "Auction snapshot is invalid." };
  const auction = value.auction;
  if (value.rulesVersion !== auction.rulesVersion || value.datasetVersion !== auction.dataVersion || value.simulationModelVersion !== auction.simulationModelVersion) {
    return { success: false, error: "Save and auction versions do not match." };
  }

  return { success: true, data: value as AuctionSaveRecord };
}
