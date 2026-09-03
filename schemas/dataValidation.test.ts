import { describe, expect, it } from "vitest";
import { PLAYERS_2027 } from "@/data/players/2027";
import { validatePlayerDataset, type Player } from "@/data/players/types";
import { generatedPortraitAsset, isSafePortraitSource, playerAccent, playerInitials, portraitForPlayer, validatePlayerPortraitManifest } from "@/data/players/assets";
import { playerDataDisclosure, playerFactDisclosure, validatePlayerSourceReferences, validateSourceRegistry, type PlayerSourceReference } from "@/data/sources/playerSources";

describe("player data validation", () => {
  it("rejects duplicate ids, invalid roles, and negative base prices", () => {
    const fixture = { ...PLAYERS_2027[0], playerId: PLAYERS_2027[1].playerId, auctionData: { ...PLAYERS_2027[0].auctionData, basePrice: -1 }, role: { ...PLAYERS_2027[0].role, primary: "INVALID" } } as unknown as Player;
    const result = validatePlayerDataset([PLAYERS_2027[0], fixture]);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/duplicate playerId|invalid role|basePrice must be positive/);
  });

  it("accepts the complete versioned dataset", () => {
    expect(validatePlayerDataset(PLAYERS_2027)).toEqual({ valid: true, errors: [] });
    expect(PLAYERS_2027.length).toBeGreaterThanOrEqual(120);
  });

  it("rejects malformed nested portrait metadata instead of throwing", () => {
    const malformed = { ...PLAYERS_2027[0], assets: { manifestVersion: "", portrait: { kind: "REMOTE", src: "javascript:alert(1)", alt: "", fallback: "BAD" } } } as unknown as Player;
    const result = validatePlayerDataset([malformed]);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/manifestVersion|portrait asset kind|portrait alt|portrait fallback/);
  });

  it("keeps portrait presentation deterministic and source-safe", () => {
    const player = PLAYERS_2027[0];
    expect(playerInitials("  Jasprit Bumrah  ")).toBe("JB");
    expect(playerInitials("Gill")).toBe("GI");
    expect(playerAccent(player.playerId)).toBe(playerAccent(player.playerId));
    expect(portraitForPlayer(player).asset).toEqual(generatedPortraitAsset(player.identity.name));
    expect(isSafePortraitSource("/assets/players/jasprit-bumrah.webp", "LOCAL")).toBe(true);
    expect(isSafePortraitSource("http://example.com/image.jpg", "REMOTE")).toBe(false);
    expect(isSafePortraitSource("https://example.com/image.jpg", "REMOTE")).toBe(true);
    expect(isSafePortraitSource("https://user:secret@example.com/image.jpg", "REMOTE")).toBe(false);
    expect(isSafePortraitSource("/assets/players/virat-kohli.webp", "LOCAL")).toBe(true);
    expect(isSafePortraitSource("/assets/players/../secret.webp", "LOCAL")).toBe(false);
  });

  it("rejects unlicensed or unsafe portrait manifest entries", () => {
    const result = validatePlayerPortraitManifest({
      "Virat Kohli": { kind: "REMOTE", src: "http://example.com/kohli.jpg", alt: "", fallback: "INITIALS" }
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/lowercase slug|source path|alt text|sourceRef|license/);
  });

  it("does not throw on malformed runtime portrait manifest values", () => {
    const result = validatePlayerPortraitManifest({ broken: null as never });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/asset must be an object/);
  });

  it("never labels unsourced projected statistics as verified", () => {
    const player = PLAYERS_2027[0];
    expect(playerDataDisclosure(player)).toMatchObject({ status: "PROJECTED", label: "Simulation inputs" });
    expect(playerFactDisclosure(player, "identity")).toMatchObject({ status: "CURATED", label: "Curated identity" });
    expect(playerFactDisclosure(player, "auctionTerms")).toMatchObject({ status: "PROJECTED", label: "Projected auction terms" });
    expect(playerFactDisclosure(player, "portrait")).toMatchObject({ status: "GENERATED", label: "Generated avatar" });
    expect(playerFactDisclosure(player, "portrait").sources.map((source) => source.id)).toContain("ui-generated-initials");
    const falseHistoricalClaim = { ...player, provenance: { ...player.provenance, stats: "HISTORICAL_SNAPSHOT" as const } };
    expect(validatePlayerSourceReferences([falseHistoricalClaim]).errors.join(" ")).toMatch(/historical statistics need a verified/);
  });

  it("rejects contradictory fact-quality claims", () => {
    const player = PLAYERS_2027[0];
    const contradictory = {
      ...player,
      dataQuality: { ...player.dataQuality!, historicalStats: "HISTORICAL_SNAPSHOT" as const, portrait: "LICENSED" as const }
    };
    expect(validatePlayerSourceReferences([contradictory]).errors.join(" ")).toMatch(/historicalStats must match|generated portrait cannot be marked LICENSED/);
  });

  it("accepts an imported historical snapshot only with its registered source", () => {
    const player = PLAYERS_2027[0];
    const source: PlayerSourceReference = {
      id: "stats-snapshot",
      title: "Player statistics snapshot",
      publisher: "Licensed cricket data provider",
      kind: "STATISTICAL",
      status: "VERIFIED",
      url: "https://example.com/player-statistics",
      accessedAt: "2026-08-26"
    };
    const registry = { "stats-snapshot": source, "ui-generated-initials": { id: "ui-generated-initials", title: "Initials", publisher: "Simulator", kind: "ASSET_LICENSE", status: "VERIFIED", license: "Original UI fallback" } } satisfies Record<string, PlayerSourceReference>;
    const imported: Player = {
      ...player,
      realData: { ...player.realData, dataStatus: "HISTORICAL_SNAPSHOT", asOf: "2026-08-26", sourceRefs: [source.id] },
      provenance: { ...player.provenance, stats: "HISTORICAL_SNAPSHOT", sourceRefs: [source.id], fieldSources: { stats: source.id, portrait: "ui-generated-initials" } },
      dataQuality: { ...player.dataQuality!, historicalStats: "HISTORICAL_SNAPSHOT" }
    };
    expect(validatePlayerSourceReferences([imported], registry)).toEqual({ valid: true, errors: [] });
    expect(playerDataDisclosure(imported, registry)).toMatchObject({ status: "VERIFIED", label: "Verified statistics", sources: [source] });
  });

  it("validates registry keys, HTTPS URLs and date metadata", () => {
    const malformed = {
      alias: { id: "different-id", title: "Bad", publisher: "Bad", kind: "STATISTICAL", status: "VERIFIED", url: "http://example.com", accessedAt: "yesterday" }
    } as unknown as Record<string, PlayerSourceReference>;
    const result = validateSourceRegistry(malformed);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/registry key|HTTPS|accessedAt|URL and access date/);
  });
});
