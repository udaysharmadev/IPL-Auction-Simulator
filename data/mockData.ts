/**
 * Compatibility barrel for the first-generation UI and engine.
 * New code should import canonical data from the dedicated modules.
 */
import { FRANCHISES_2027 } from "@/data/teams/franchises";
import { PLAYERS_2027 } from "@/data/players/2027";
import { RULE_SET_SNAPSHOT } from "@/data/rules";

export { FRANCHISES_2027, FRANCHISE_BY_ID, FRANCHISE_IDS } from "@/data/teams/franchises";
export { PLAYERS_2027, PLAYER_BY_ID, PLAYERS_BY_CATEGORY, PLAYER_DATASET_VALIDATION, PLAYER_DATASET_VERSION, PLAYER_SOURCE_REFERENCE_VALIDATION, PLAYER_SOURCE_COVERAGE } from "@/data/players/2027";
export { PLAYER_ASSET_MANIFEST_VERSION, PLAYER_PORTRAIT_MANIFEST, PLAYER_PORTRAIT_MANIFEST_VALIDATION, playerAccent, playerAssets, playerInitials, portraitForPlayer, validatePlayerPortraitManifest } from "@/data/players/assets";
export { PLAYER_SOURCE_REGISTRY, PLAYER_SOURCE_REGISTRY_VERSION, playerDataDisclosure, playerFactDisclosure, playerFactDisclosures, playerSourceCoverage, sourcesForPlayer, sourcesForPlayerField, validateSourceRegistry } from "@/data/sources/playerSources";
export {
  AUCTION_CATEGORIES,
  PLAYER_ROLES,
  validatePlayerDataset,
  type AuctionCategory,
  type AvailabilityStatus,
  type CappedStatus,
  type FormTrend,
  type Player,
  type PlayerDataQuality,
  type PlayerFactStatus,
  type PlayerPortraitDataStatus,
  type Role,
  type NationalityStatus
} from "@/data/players/types";
export type { Franchise, FranchiseId } from "@/data/teams/franchises";

export const AUCTION_RULES = {
  startingPurse: RULE_SET_SNAPSHOT.auction.startingPurse,
  maxSquadSize: RULE_SET_SNAPSHOT.auction.maxSquadSize,
  maxOverseas: RULE_SET_SNAPSHOT.auction.maxOverseas,
  minSquadSize: RULE_SET_SNAPSHOT.auction.minSquadSize,
  datasetVersion: RULE_SET_SNAPSHOT.dataVersion
} as const;

/** Stable aliases retained for existing consumers. */
export const PLAYERS = PLAYERS_2027;
export const FRANCHISES = FRANCHISES_2027;
