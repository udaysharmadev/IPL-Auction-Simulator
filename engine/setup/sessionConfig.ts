import { PLAYERS_2027 } from "@/data/players/2027";
import type { Player } from "@/data/players/types";
import { RULE_SET_SNAPSHOT } from "@/data/rules";
import type { AuctionFormat, Difficulty, GameSetup, GraphicsQuality } from "@/domain/onboarding";
import type { RuleSetSnapshot } from "@/domain/rules";
import { createNamedRng } from "@/engine/random/seededRng";

/**
 * A resolved setup is the only configuration the auction aggregate needs.
 * Keeping it outside React makes format and difficulty replayable and keeps
 * the presentation layer from quietly changing game rules.
 */
export type AuctionSessionConfig = {
  setup: GameSetup;
  rules: RuleSetSnapshot;
  players: readonly Player[];
  poolLabel: string;
};

/** Minimal persisted identity used to reject a save from another profile. */
export type AuctionSessionIdentity = {
  userFranchiseId?: string | null;
  seed?: string | null;
  format?: AuctionFormat;
  difficulty?: Difficulty;
  rulesVersion?: string;
};

export const QUICK_PLAYER_LIMIT = 48;

const AUCTION_FORMATS: readonly AuctionFormat[] = ["AUTHENTIC", "QUICK", "CUSTOM"];
const DIFFICULTIES: readonly Difficulty[] = ["ROOKIE", "STRATEGIST", "EXPERT", "GM"];
const GRAPHICS_QUALITIES: readonly GraphicsQuality[] = ["ULTRA", "HIGH", "BALANCED", "PERFORMANCE"];

const QUICK_CATEGORY_QUOTAS: Readonly<Record<string, number>> = {
  MARQUEE: 8,
  CAPPED_INDIAN: 14,
  CAPPED_OVERSEAS: 10,
  UNCAPPED: 16
};

/** Human-facing metadata used by setup preview and telemetry. */
export function auctionFormatDescription(format: AuctionFormat) {
  if (format === "QUICK") return { poolLabel: `${QUICK_PLAYER_LIMIT} player compact pool`, duration: "10–20", rulesLabel: "Compact rules" };
  if (format === "CUSTOM") return { poolLabel: `${PLAYERS_2027.length} player sandbox pool`, duration: "20–60", rulesLabel: "Sandbox rules" };
  return { poolLabel: `${PLAYERS_2027.length} player full pool`, duration: "30–90", rulesLabel: "Projected IPL rules" };
}

export function resolveAuctionSession(partial: Partial<GameSetup> | null | undefined, baseRules: RuleSetSnapshot = RULE_SET_SNAPSHOT): AuctionSessionConfig {
  // Setup is persisted in browser storage and can outlive a deployment. Treat
  // it as untrusted input at this boundary so a malformed value cannot crash
  // onboarding or leak an invalid profile into the auction aggregate.
  const format = isAuctionFormat(partial?.format) ? partial.format : "AUTHENTIC";
  const difficulty = isDifficulty(partial?.difficulty) ? partial.difficulty : "STRATEGIST";
  const graphicsQuality = isGraphicsQuality(partial?.graphicsQuality) ? partial.graphicsQuality : "HIGH";
  const seed = typeof partial?.seed === "string" && partial.seed.trim().length > 0
    ? partial.seed.trim()
    : "2027-AUCTION-847293";

  if (format === "QUICK") {
    const rules = withRules(baseRules, {
      id: `${baseRules.id}-quick`,
      version: `${baseRules.version}-QUICK`,
      status: "CUSTOM",
      auction: {
        ...baseRules.auction,
        startingPurse: 30,
        minSquadSize: 8,
        maxSquadSize: 15,
        maxOverseas: 5,
        acceleratedEnabled: false,
        categoryOrder: ["MARQUEE", "CAPPED_INDIAN", "CAPPED_OVERSEAS", "UNCAPPED"]
      }
    });
    const setup = normalizedSetup({ format, difficulty, graphicsQuality, seed }, rules.version);
    return { setup, rules, players: compactPool(seed), poolLabel: auctionFormatDescription(format).poolLabel };
  }

  if (format === "CUSTOM") {
    const rules = withRules(baseRules, {
      id: `${baseRules.id}-sandbox`,
      version: `${baseRules.version}-SANDBOX`,
      status: "CUSTOM",
      auction: {
        ...baseRules.auction,
        startingPurse: 75,
        minSquadSize: 8,
        maxSquadSize: 25,
        maxOverseas: 10
      }
    });
    const setup = normalizedSetup({ format, difficulty, graphicsQuality, seed }, rules.version);
    return { setup, rules, players: PLAYERS_2027, poolLabel: auctionFormatDescription(format).poolLabel };
  }

  const setup = normalizedSetup({ format: "AUTHENTIC", difficulty, graphicsQuality, seed }, baseRules.version);
  return { setup, rules: baseRules, players: PLAYERS_2027, poolLabel: auctionFormatDescription("AUTHENTIC").poolLabel };
}

/**
 * Compare a persisted auction with the setup currently selected in onboarding.
 * Graphics quality is deliberately excluded because it changes rendering only.
 * Saves from before session metadata existed are accepted for the original
 * Authentic/Strategist profile and rejected for every other profile.
 */
export function auctionMatchesSession(
  auction: AuctionSessionIdentity | null | undefined,
  franchiseId: string | null | undefined,
  setup: Partial<GameSetup> | string
): boolean {
  if (!auction || !franchiseId || auction.userFranchiseId !== franchiseId) return false;
  const session = resolveAuctionSession(typeof setup === "string" ? { seed: setup } : setup);
  if (auction.seed !== session.setup.seed) return false;

  // Missing profile fields identify a legacy save. Its only safe interpretation
  // is the original default profile; never reuse it for Quick/Custom or a
  // different AI behavior profile with the same seed.
  const formatMatches = auction.format === undefined
    ? session.setup.format === "AUTHENTIC"
    : auction.format === session.setup.format;
  const difficultyMatches = auction.difficulty === undefined
    ? session.setup.difficulty === "STRATEGIST"
    : auction.difficulty === session.setup.difficulty;
  if (!formatMatches || !difficultyMatches) return false;
  return auction.rulesVersion === undefined || auction.rulesVersion === session.rules.version;
}

function isAuctionFormat(value: unknown): value is AuctionFormat {
  return typeof value === "string" && AUCTION_FORMATS.includes(value as AuctionFormat);
}

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && DIFFICULTIES.includes(value as Difficulty);
}

function isGraphicsQuality(value: unknown): value is GraphicsQuality {
  return typeof value === "string" && GRAPHICS_QUALITIES.includes(value as GraphicsQuality);
}

function normalizedSetup(values: Omit<GameSetup, "rulesVersion">, rulesVersion: string): GameSetup {
  return { ...values, rulesVersion };
}

function withRules(base: RuleSetSnapshot, override: Partial<RuleSetSnapshot>): RuleSetSnapshot {
  return {
    ...base,
    ...override,
    auction: { ...base.auction, ...(override.auction ?? {}) }
  } as RuleSetSnapshot;
}

function compactPool(seed: string): readonly Player[] {
  const selected: Player[] = [];
  const used = new Set<string>();
  (Object.entries(QUICK_CATEGORY_QUOTAS) as [Player["auctionData"]["category"], number][]).forEach(([category, quota]) => {
    const candidates = PLAYERS_2027
      .filter((player) => player.auctionData.category === category)
      .sort((left, right) => left.playerId.localeCompare(right.playerId));
    const rng = createNamedRng(seed, "quick-pool", category);
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swap = rng.int(0, index);
      [candidates[index], candidates[swap]] = [candidates[swap], candidates[index]];
    }
    candidates.slice(0, quota).forEach((player) => { selected.push(player); used.add(player.playerId); });
  });

  // Dataset updates should not silently produce a tiny quick auction when a
  // category is temporarily under-filled. Fill from the remaining pool in a
  // stable seeded order while preserving the no-duplicate invariant.
  if (selected.length < QUICK_PLAYER_LIMIT) {
    const remainder = PLAYERS_2027
      .filter((player) => !used.has(player.playerId) && player.auctionData.category !== "ACCELERATED")
      .sort((left, right) => left.playerId.localeCompare(right.playerId));
    const rng = createNamedRng(seed, "quick-pool", "remainder");
    for (let index = remainder.length - 1; index > 0; index -= 1) {
      const swap = rng.int(0, index);
      [remainder[index], remainder[swap]] = [remainder[swap], remainder[index]];
    }
    remainder.slice(0, QUICK_PLAYER_LIMIT - selected.length).forEach((player) => selected.push(player));
  }
  return selected;
}

export type { AuctionFormat, Difficulty, GraphicsQuality };
