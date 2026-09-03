import {
  createAuctionSaveRecord,
  isAuctionState,
  parseAuctionSaveRecord,
  type AuctionSaveRecord,
  type AuctionSaveVersions
} from "@/schemas/save.schema";
import { createAuction, buildNeeds, type AuctionPhase, type AuctionEvent, type AuctionState } from "@/engine/auctionEngine";
import { PLAYERS_2027, PLAYER_DATASET_VERSION } from "@/data/players/2027";
import { FRANCHISES_2027, type FranchiseId } from "@/data/teams/franchises";
import { RULE_SET_SNAPSHOT } from "@/data/rules";
import { categoryForPlayer, categoryRoundAt } from "@/engine/auction/orderGenerator";

const DATABASE_NAME = "ipl-auction-simulator";
const DATABASE_VERSION = 1;
const STORE_NAME = "auction-saves";
const FALLBACK_PREFIX = "ipl-auction-save:";
const LEGACY_PREFIX = "ipl-auction-";

type SaveKeyParts = { franchiseId: string; seed: string };

/**
 * Save keys deliberately allow `::` inside the seed because setup profiles
 * append format/difficulty metadata. Always split at the first separator so
 * legacy-key migration never truncates a composite session identity.
 */
function splitSaveKey(key: string): SaveKeyParts | null {
  const separator = key.indexOf("::");
  if (separator <= 0 || separator + 2 >= key.length) return null;
  const franchiseId = key.slice(0, separator);
  const seed = key.slice(separator + 2);
  return franchiseId && seed ? { franchiseId, seed } : null;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type AuctionSaveRepositoryOptions = {
  indexedDB?: IDBFactory | null;
  fallbackStorage?: StorageLike | null;
};

export type AuctionSaveRepository = {
  save: (key: string, auction: AuctionState, versions: AuctionSaveVersions) => Promise<AuctionSaveRecord>;
  load: (key: string) => Promise<AuctionSaveRecord | null>;
  remove: (key: string) => Promise<void>;
};

export function auctionSaveKey(franchiseId: string, seed: string): string {
  if (!franchiseById.has(franchiseId as FranchiseId)) throw new Error(`Unknown franchise in save key: ${franchiseId}`);
  if (!seed.trim()) throw new Error("Auction seed is required for a save key.");
  return `${franchiseId}::${seed}`;
}

function browserIndexedDb(): IDBFactory | null {
  return typeof window === "undefined" ? null : window.indexedDB ?? null;
}

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function openDatabase(indexedDB: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      reject(error);
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB."));
    request.onblocked = () => reject(new Error("IndexedDB upgrade was blocked."));
  });
}

async function withStore<T>(
  indexedDB: IDBFactory,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await openDatabase(indexedDB);
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    });
  } finally {
    database.close();
  }
}

function readFallback(storage: StorageLike | null, key: string): AuctionSaveRecord | null {
  if (!storage) return null;
  const storageKey = `${FALLBACK_PREFIX}${key}`;
  try {
    const serialized = storage.getItem(storageKey);
    if (serialized) {
      const legacyState = JSON.parse(serialized) as unknown;
      const parsed = parseAuctionSaveRecord(legacyState);
      if (parsed.success) return parsed.data;
      const migrated = migrateLegacyAuction(legacyState, key);
      if (migrated) return writeMigratedFallback(storage, key, migrated);
      storage.removeItem(storageKey);
    }

    const keyParts = splitSaveKey(key);
    if (!keyParts) return null;
    const { franchiseId, seed } = keyParts;
    const legacyKey = `${LEGACY_PREFIX}${franchiseId}-${seed}`;
    const legacy = storage.getItem(legacyKey);
    if (!legacy) return null;
    const legacyState = JSON.parse(legacy) as unknown;
    const migrated = migrateLegacyAuction(legacyState, key);
    if (!migrated) {
      storage.removeItem(legacyKey);
      return null;
    }
    const record = writeMigratedFallback(storage, key, migrated);
    storage.removeItem(legacyKey);
    return record;
  } catch {
    return null;
  }
}

/** Write-through upgrades raw legacy snapshots so future reads use the schema boundary. */
function writeMigratedFallback(storage: StorageLike, key: string, auction: AuctionState): AuctionSaveRecord {
  const record = createAuctionSaveRecord(key, auction, {
    rulesVersion: RULE_SET_SNAPSHOT.version,
    datasetVersion: PLAYER_DATASET_VERSION,
    simulationModelVersion: RULE_SET_SNAPSHOT.simulationModelVersion
  });
  storage.setItem(`${FALLBACK_PREFIX}${key}`, JSON.stringify(record));
  return record;
}

const playerIds = new Set(PLAYERS_2027.map((player) => player.playerId));
const franchiseById = new Map(FRANCHISES_2027.map((franchise) => [franchise.id, franchise]));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstValue(record: Record<string, unknown>, keys: readonly string[]): unknown {
  return keys.map((key) => record[key]).find((value) => value !== undefined);
}

function stringValue(record: Record<string, unknown>, keys: readonly string[]): string | null {
  const value = firstValue(record, keys);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(record: Record<string, unknown>, keys: readonly string[]): number | null {
  const value = firstValue(record, keys);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringList(record: Record<string, unknown>, keys: readonly string[]): string[] {
  const value = firstValue(record, keys);
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function knownPlayerList(value: string[]): string[] {
  return [...new Set(value.filter((playerId) => playerIds.has(playerId)))];
}

function migrateLegacyAuction(value: unknown, key: string): AuctionState | null {
  if (!isRecord(value)) return null;
  const keyParts = splitSaveKey(key);
  const keyFranchiseId = keyParts?.franchiseId ?? "KKR";
  const keySeed = keyParts?.seed ?? key;
  const requestedFranchiseId = stringValue(value, ["userFranchiseId", "franchiseId", "teamId"]) ?? keyFranchiseId;
  const seed = stringValue(value, ["seed", "auctionSeed"]) ?? keySeed;
  if (!franchiseById.has(requestedFranchiseId as FranchiseId) || !seed) return null;
  const userFranchiseId = requestedFranchiseId as FranchiseId;

  const fresh = createAuction(userFranchiseId, seed);
  const candidateOrder = knownPlayerList(stringList(value, ["order", "auctionOrder", "playerOrder"]));
  const order = candidateOrder.length > 0 ? candidateOrder : fresh.order;
  const requestedIndex = numberValue(value, ["currentIndex", "currentPlayerIndex", "playerIndex"]);
  const currentIndex = Math.max(0, Math.min(order.length - 1, Math.trunc(requestedIndex ?? 0)));
  const requestedPlayerId = stringValue(value, ["currentPlayerId", "activePlayerId"]);
  const currentPlayerId = requestedPlayerId && playerIds.has(requestedPlayerId) ? requestedPlayerId : order[currentIndex] ?? fresh.currentPlayerId;
  const currentPlayer = PLAYERS_2027.find((player) => player.playerId === currentPlayerId) ?? PLAYERS_2027[0];
  if (!currentPlayer) return null;

  const phaseValue = stringValue(value, ["phase", "status"]);
  const phases: readonly AuctionPhase[] = ["INTRO", "PLAYER_PRESENTATION", "FIRST_BID", "BIDDING", "FINAL_CALL", "SOLD", "PASSED", "COMPLETE"];
  const phase: AuctionPhase = phases.includes(phaseValue as AuctionPhase) ? phaseValue as AuctionPhase : "FIRST_BID";
  const completed = Boolean(value.completed) || phase === "COMPLETE";
  const highestBidder = stringValue(value, ["highestBidder", "leadingTeam", "currentLeader"]);
  const normalizedBidder = highestBidder === "YOU" || !highestBidder ? highestBidder : (franchiseById.get(highestBidder as FranchiseId)?.shortName ?? highestBidder);
  const userSquad = knownPlayerList(stringList(value, ["userSquad", "squad", "ownedPlayers"]));
  const aiSquadsValue = firstValue(value, ["aiSquads", "rivalSquads"]);
  const aiSquads = { ...fresh.aiSquads };
  if (isRecord(aiSquadsValue)) {
    Object.entries(aiSquadsValue).forEach(([teamId, players]) => {
      if (teamId !== userFranchiseId && Array.isArray(players)) aiSquads[teamId] = knownPlayerList(players.filter((entry): entry is string => typeof entry === "string"));
    });
  }
  const aiBudgetsValue = firstValue(value, ["aiBudgets", "rivalBudgets"]);
  const aiBudgets = { ...fresh.aiBudgets };
  if (isRecord(aiBudgetsValue)) {
    Object.entries(aiBudgetsValue).forEach(([teamId, budget]) => {
      if (teamId !== userFranchiseId && typeof budget === "number" && Number.isFinite(budget)) aiBudgets[teamId] = Math.max(0, budget);
    });
  }
  const userBudget = Math.max(0, numberValue(value, ["userBudget", "budget", "purse"]) ?? fresh.userBudget);
  const currentBid = Math.max(0, numberValue(value, ["currentBid", "bid"]) ?? 0);
  const events = Array.isArray(value.events) ? value.events.filter(isLegacyEvent).map((event) => event as AuctionEvent) : fresh.events;
  const ruleSet = RULE_SET_SNAPSHOT;
  const auctionCategory = categoryForPlayer(currentPlayer);

  return {
    ...fresh,
    phase,
    round: categoryRoundAt(order, currentIndex, PLAYERS_2027),
    category: auctionCategory,
    auctionCategory,
    currentIndex,
    currentPlayerId: currentPlayer.playerId,
    currentBid,
    highestBidder: normalizedBidder,
    userBudget,
    userSquad,
    aiBudgets,
    aiSquads,
    needs: buildNeeds(userSquad, PLAYERS_2027, { maxSquadSize: ruleSet.auction.maxSquadSize, minSquadSize: ruleSet.auction.minSquadSize, maxOverseas: ruleSet.auction.maxOverseas }),
    order,
    remainingPlayers: completed ? 0 : Math.max(0, order.length - currentIndex),
    message: stringValue(value, ["message", "statusMessage"]) ?? fresh.message,
    events: events.length > 0 ? events : fresh.events,
    soundOn: typeof value.soundOn === "boolean" ? value.soundOn : fresh.soundOn,
    completed,
    userMaxBid: numberValue(value, ["userMaxBid", "maxBid"]) ?? null,
    smartMaxEnabled: Boolean(value.smartMaxEnabled),
    tension: Math.max(0, Math.min(100, numberValue(value, ["tension"]) ?? fresh.tension)),
    aiTrace: null,
    rulesVersion: ruleSet.version,
    dataVersion: ruleSet.dataVersion,
    simulationModelVersion: ruleSet.simulationModelVersion,
    ruleSet
  };
}

function isLegacyEvent(value: unknown): value is Record<string, unknown> & { id: string; text: string; type: AuctionEvent["type"] } {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.text !== "string") return false;
  return ["bid", "sold", "pass", "system", "warning"].includes(value.type as string);
}

export function createAuctionSaveRepository(options: AuctionSaveRepositoryOptions = {}): AuctionSaveRepository {
  const indexedDB = options.indexedDB === undefined ? browserIndexedDb() : options.indexedDB;
  const fallbackStorage = options.fallbackStorage === undefined ? browserStorage() : options.fallbackStorage;

  return {
    async save(key, auction, versions) {
      const record = createAuctionSaveRecord(key, auction, versions);
      if (indexedDB) {
        try {
          await withStore(indexedDB, "readwrite", (store) => store.put(record));
          return record;
        } catch {
          // Private browsing, quota limits, and blocked databases fall back safely.
        }
      }
      if (!fallbackStorage) throw new Error("No browser persistence adapter is available.");
      fallbackStorage.setItem(`${FALLBACK_PREFIX}${key}`, JSON.stringify(record));
      return record;
    },

    async load(key) {
      if (indexedDB) {
        try {
          const value = await withStore<unknown>(indexedDB, "readonly", (store) => store.get(key));
          if (value !== undefined) {
            const parsed = parseAuctionSaveRecord(value);
            if (parsed.success) return parsed.data;
            await withStore(indexedDB, "readwrite", (store) => store.delete(key));
          }
        } catch {
          // A database failure is not fatal; try the small compatibility fallback.
        }
      }
      return readFallback(fallbackStorage, key);
    },

    async remove(key) {
      if (indexedDB) {
        try {
          await withStore(indexedDB, "readwrite", (store) => store.delete(key));
        } catch {
          // Continue to clear the fallback even when IndexedDB is unavailable.
        }
      }
      try {
        fallbackStorage?.removeItem(`${FALLBACK_PREFIX}${key}`);
      } catch {
        // Removal is best effort because storage may become unavailable at runtime.
      }
    }
  };
}

export const auctionSaveRepository = createAuctionSaveRepository();
