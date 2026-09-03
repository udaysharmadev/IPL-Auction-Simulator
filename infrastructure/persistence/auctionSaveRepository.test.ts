import { describe, expect, it } from "vitest";
import { PLAYER_DATASET_VERSION } from "@/data/players/2027";
import { RULE_SET_SNAPSHOT } from "@/data/rules";
import { createAuction } from "@/engine/auctionEngine";
import { auctionSaveKey, createAuctionSaveRepository, type StorageLike } from "./auctionSaveRepository";

function memoryStorage(): StorageLike & { size: () => number } {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    size: () => values.size
  };
}

const versions = {
  rulesVersion: RULE_SET_SNAPSHOT.version,
  datasetVersion: PLAYER_DATASET_VERSION,
  simulationModelVersion: RULE_SET_SNAPSHOT.simulationModelVersion
};

describe("auction save repository", () => {
  it("uses the local fallback when IndexedDB is unavailable", async () => {
    const fallbackStorage = memoryStorage();
    const repository = createAuctionSaveRepository({ indexedDB: null, fallbackStorage });
    const auction = createAuction("KKR", "fallback-test");
    const key = auctionSaveKey(auction.userFranchiseId, auction.seed);

    await repository.save(key, auction, versions);
    const loaded = await repository.load(key);

    expect(loaded?.auction).toEqual(auction);
    expect(loaded?.datasetVersion).toBe(versions.datasetVersion);
    expect(fallbackStorage.size()).toBe(1);
  });

  it("rejects corrupt fallback data and recovers with an empty result", async () => {
    const fallbackStorage = memoryStorage();
    const key = auctionSaveKey("MI", "corrupt-test");
    fallbackStorage.setItem(`ipl-auction-save:${key}`, "{not-json");
    const repository = createAuctionSaveRepository({ indexedDB: null, fallbackStorage });

    await expect(repository.load(key)).resolves.toBeNull();
  });

  it("removes saved checkpoints", async () => {
    const fallbackStorage = memoryStorage();
    const repository = createAuctionSaveRepository({ indexedDB: null, fallbackStorage });
    const auction = createAuction("RCB", "delete-test");
    const key = auctionSaveKey(auction.userFranchiseId, auction.seed);

    await repository.save(key, auction, versions);
    await repository.remove(key);

    await expect(repository.load(key)).resolves.toBeNull();
  });

  it("keeps composite session seeds intact and rejects malformed save keys", async () => {
    const fallbackStorage = memoryStorage();
    const repository = createAuctionSaveRepository({ indexedDB: null, fallbackStorage });
    const compositeSeed = "shared-room::QUICK::GM";
    const auction = createAuction("GT", compositeSeed);
    const key = auctionSaveKey("GT", compositeSeed);
    await repository.save(key, auction, versions);

    expect(key).toBe("GT::shared-room::QUICK::GM");
    await expect(repository.load(key)).resolves.toMatchObject({ auction: { seed: compositeSeed, userFranchiseId: "GT" } });
    expect(() => auctionSaveKey("UNKNOWN", "seed")).toThrow(/Unknown franchise/);
    expect(() => auctionSaveKey("GT", "   ")).toThrow(/seed is required/);
  });

  it("migrates legacy localStorage checkpoints into the versioned save format", async () => {
    const fallbackStorage = memoryStorage();
    const repository = createAuctionSaveRepository({ indexedDB: null, fallbackStorage });
    const legacyAuction = createAuction("MI", "legacy-test");
    const key = auctionSaveKey("MI", "legacy-test");
    fallbackStorage.setItem("ipl-auction-MI-legacy-test", JSON.stringify({
      seed: legacyAuction.seed,
      franchiseId: legacyAuction.userFranchiseId,
      phase: "BIDDING",
      currentPlayerIndex: 1,
      currentBid: 3,
      budget: 42,
      squad: [legacyAuction.order[0]],
      order: legacyAuction.order,
      events: legacyAuction.events
    }));

    const loaded = await repository.load(key);

    expect(loaded?.auction.userFranchiseId).toBe("MI");
    expect(loaded?.auction.userBudget).toBe(42);
    expect(loaded?.auction.userSquad).toEqual([legacyAuction.order[0]]);
    expect(loaded?.auction.ruleSet.version).toBe("2027-PROJECTED-v1");
    expect(loaded?.datasetVersion).toBe("2027.1.0");
    expect(fallbackStorage.size()).toBe(1);
  });

  it("migrates a raw legacy snapshot stored under the versioned fallback key", async () => {
    const fallbackStorage = memoryStorage();
    const repository = createAuctionSaveRepository({ indexedDB: null, fallbackStorage });
    const legacyAuction = createAuction("CSK", "legacy-versioned-key-test");
    const key = auctionSaveKey("CSK", legacyAuction.seed);
    fallbackStorage.setItem(`ipl-auction-save:${key}`, JSON.stringify({
      auctionSeed: legacyAuction.seed,
      teamId: legacyAuction.userFranchiseId,
      status: "BIDDING",
      playerIndex: 2,
      bid: 4.5,
      purse: 37.5,
      ownedPlayers: [legacyAuction.order[0]],
      playerOrder: legacyAuction.order,
      events: legacyAuction.events
    }));

    const loaded = await repository.load(key);
    const stored = fallbackStorage.getItem(`ipl-auction-save:${key}`);

    expect(loaded?.auction.userFranchiseId).toBe("CSK");
    expect(loaded?.auction.seed).toBe(legacyAuction.seed);
    expect(loaded?.auction.userBudget).toBe(37.5);
    expect(loaded?.auction.userSquad).toEqual([legacyAuction.order[0]]);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? "null").schemaVersion).toBe(1);
    expect(fallbackStorage.size()).toBe(1);
  });

  it("migrates a legacy composite session key without truncating its seed", async () => {
    const fallbackStorage = memoryStorage();
    const repository = createAuctionSaveRepository({ indexedDB: null, fallbackStorage });
    const compositeSeed = "shared-room::QUICK::GM";
    const legacyAuction = createAuction("GT", compositeSeed);
    const key = auctionSaveKey("GT", compositeSeed);
    fallbackStorage.setItem(`ipl-auction-GT-${compositeSeed}`, JSON.stringify({
      seed: compositeSeed,
      franchiseId: "GT",
      phase: "BIDDING",
      currentPlayerIndex: 1,
      currentBid: 3,
      budget: 42,
      squad: [legacyAuction.order[0]],
      order: legacyAuction.order,
      events: legacyAuction.events
    }));

    const loaded = await repository.load(key);

    expect(loaded?.auction.seed).toBe(compositeSeed);
    expect(loaded?.auction.userFranchiseId).toBe("GT");
    expect(fallbackStorage.size()).toBe(1);
  });
});
