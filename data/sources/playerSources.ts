import type { Player, PlayerDataQuality, PlayerFactStatus, PlayerPortraitDataStatus } from "@/data/players/types";

export const PLAYER_SOURCE_REGISTRY_VERSION = "2027-sources.1.1";

export type PlayerSourceKind = "OFFICIAL" | "STATISTICAL" | "EDITORIAL" | "INTERNAL_MODEL" | "ASSET_LICENSE";
export type PlayerSourceStatus = "VERIFIED" | "PROJECTED" | "UNVERIFIED";

export type PlayerSourceReference = {
  id: string;
  title: string;
  publisher: string;
  kind: PlayerSourceKind;
  status: PlayerSourceStatus;
  url?: string;
  accessedAt?: string;
  license?: string;
  note?: string;
};

export const PLAYER_SOURCE_REGISTRY = {
  "projected-player-pack-2027": {
    id: "projected-player-pack-2027",
    title: "IPL Auction Simulator projected 2027 player pack",
    publisher: "IPL Auction Simulator",
    kind: "INTERNAL_MODEL",
    status: "PROJECTED",
    note: "Identity labels are curated; statistics, ratings and valuations are simulation inputs until independently sourced."
  },
  "ui-generated-initials": {
    id: "ui-generated-initials",
    title: "Deterministic player initials",
    publisher: "IPL Auction Simulator",
    kind: "ASSET_LICENSE",
    status: "VERIFIED",
    license: "Original UI fallback",
    note: "This is a generated interface treatment, not a player photograph."
  }
} as const satisfies Record<string, PlayerSourceReference>;

export type PlayerSourceId = keyof typeof PLAYER_SOURCE_REGISTRY;

export type SourceReferenceValidation = { valid: boolean; errors: string[] };
export type PlayerDataDisclosure = {
  status: "VERIFIED" | "PROJECTED";
  label: string;
  detail: string;
  sources: PlayerSourceReference[];
};
export type PlayerFactField = "identity" | "role" | "historicalStats" | "auctionTerms" | "availability" | "portrait";
export type PlayerFactDisclosure = {
  field: PlayerFactField;
  status: PlayerFactStatus | PlayerPortraitDataStatus;
  label: string;
  detail: string;
  sources: PlayerSourceReference[];
};
export type PlayerSourceCoverage = {
  playerCount: number;
  verifiedIdentities: number;
  curatedIdentities: number;
  projectedIdentities: number;
  generatedIdentities: number;
  unverifiedIdentities: number;
  verifiedStatSnapshots: number;
  projectedStatSnapshots: number;
  verifiedAuctionTerms: number;
  verifiedAvailability: number;
  licensedPortraits: number;
  generatedPortraits: number;
  unavailablePortraits: number;
  unresolvedSourceRefs: string[];
};

function isSafeSourceUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function isSourceRecord(value: unknown): value is PlayerSourceReference {
  if (typeof value !== "object" || value === null) return false;
  const source = value as Record<string, unknown>;
  return typeof source.id === "string" && typeof source.title === "string" && typeof source.publisher === "string" &&
    ["OFFICIAL", "STATISTICAL", "EDITORIAL", "INTERNAL_MODEL", "ASSET_LICENSE"].includes(source.kind as string) &&
    ["VERIFIED", "PROJECTED", "UNVERIFIED"].includes(source.status as string);
}

function uniqueSources(sourceIds: readonly string[], registry: Record<string, PlayerSourceReference>): PlayerSourceReference[] {
  return [...new Set(sourceIds)]
    .map((sourceId) => registry[sourceId])
    .filter((source): source is PlayerSourceReference => isSourceRecord(source));
}

function qualityForPlayer(player: Player): PlayerDataQuality {
  const fallbackFactStatus: PlayerFactStatus = player.provenance?.profile === "GENERATED" ? "PROJECTED" : "CURATED";
  const dataQuality = player.dataQuality as Partial<PlayerDataQuality> | undefined;
  const validFactStatus = (value: unknown): value is PlayerFactStatus => ["VERIFIED", "CURATED", "PROJECTED", "UNVERIFIED"].includes(value as string);
  const validPortraitStatus = (value: unknown): value is PlayerPortraitDataStatus => ["LICENSED", "GENERATED", "UNAVAILABLE"].includes(value as string);
  return {
    identity: validFactStatus(dataQuality?.identity) ? dataQuality.identity : fallbackFactStatus,
    role: validFactStatus(dataQuality?.role) ? dataQuality.role : fallbackFactStatus,
    historicalStats: dataQuality?.historicalStats === "HISTORICAL_SNAPSHOT" ? "HISTORICAL_SNAPSHOT" : "SIMULATION_GENERATED",
    auctionTerms: validFactStatus(dataQuality?.auctionTerms) ? dataQuality.auctionTerms : "PROJECTED",
    availability: validFactStatus(dataQuality?.availability) ? dataQuality.availability : "PROJECTED",
    portrait: validPortraitStatus(dataQuality?.portrait) ? dataQuality.portrait : player.assets?.portrait?.kind === "GENERATED" ? "GENERATED" : player.assets?.portrait?.kind === "LOCAL" || player.assets?.portrait?.kind === "REMOTE" ? "LICENSED" : "UNAVAILABLE",
    asOf: typeof dataQuality?.asOf === "string" ? dataQuality.asOf : undefined,
    notes: Array.isArray(dataQuality?.notes) ? dataQuality.notes.filter((note): note is string => typeof note === "string") : undefined
  };
}

function hasEligibleVerifiedSource(sources: readonly PlayerSourceReference[], permittedKinds: readonly PlayerSourceKind[], requireLicense = false): boolean {
  return sources.some((source) => source.status === "VERIFIED" && permittedKinds.includes(source.kind) && (!requireLicense || Boolean(source.license?.trim())));
}

/**
 * Cross-validates player records against the versioned registry. This runs at
 * dataset construction time so stale/broken source IDs fail the build rather
 * than appearing as authoritative UI labels.
 */
export function validatePlayerSourceReferences(
  players: readonly Player[],
  registry: Record<string, PlayerSourceReference> = PLAYER_SOURCE_REGISTRY
): SourceReferenceValidation {
  const errors: string[] = [];

  const sourceIds = new Set<string>();
  Object.entries(registry).forEach(([registryId, source]) => {
    if (!isSourceRecord(source)) {
      errors.push(`Source ${registryId || "missing-id"} is malformed`);
      return;
    }
    if (registryId !== source.id) errors.push(`Source registry key ${registryId} does not match source ID ${source.id}`);
    if (sourceIds.has(source.id)) errors.push(`Source ${source.id} is duplicated`);
    sourceIds.add(source.id);
    if (!source.id.trim() || !source.title.trim() || !source.publisher.trim()) errors.push(`Source ${source.id || "missing-id"} is incomplete`);
    if (source.url !== undefined && !isSafeSourceUrl(source.url)) errors.push(`Source ${source.id} must use HTTPS`);
    if (source.accessedAt !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(source.accessedAt) || Number.isNaN(Date.parse(source.accessedAt)))) errors.push(`Source ${source.id} has an invalid accessedAt date`);
    if (source.status === "VERIFIED" && source.kind !== "INTERNAL_MODEL" && source.kind !== "ASSET_LICENSE" && (!source.url || !source.accessedAt)) {
      errors.push(`Verified external source ${source.id} needs a URL and access date`);
    }
    if (source.status === "VERIFIED" && source.kind === "ASSET_LICENSE" && !source.license?.trim()) errors.push(`Verified asset source ${source.id} needs a license note`);
  });

  players.forEach((player) => {
    if (!player || typeof player !== "object") {
      errors.push("player record is malformed");
      return;
    }
    if (!player.provenance || typeof player.provenance !== "object" || !player.realData || typeof player.realData !== "object" || !player.assets?.portrait) {
      errors.push(`${typeof player.playerId === "string" ? player.playerId : "missing-id"}: source metadata is incomplete`);
      return;
    }
    const provenanceSourceRefs = Array.isArray(player.provenance?.sourceRefs) ? player.provenance.sourceRefs : [];
    const statsSourceRefs = Array.isArray(player.realData?.sourceRefs) ? player.realData.sourceRefs : provenanceSourceRefs;
    const fieldSourceRefs = Object.values(player.provenance?.fieldSources ?? {}).filter((sourceId): sourceId is string => typeof sourceId === "string");
    [...provenanceSourceRefs, ...statsSourceRefs, ...fieldSourceRefs].forEach((sourceId) => {
      if (!registry[sourceId]) errors.push(`${player.playerId}: unknown source reference ${sourceId}`);
    });
    const portraitSource = player.assets?.portrait?.sourceRef;
    if (portraitSource && !registry[portraitSource]) errors.push(`${player.playerId}: unknown portrait source reference ${portraitSource}`);
    if (player.realData?.dataStatus && player.realData.dataStatus !== player.provenance.stats) errors.push(`${player.playerId}: realData.dataStatus must match provenance.stats`);
    if (player.dataQuality?.historicalStats && player.dataQuality.historicalStats !== player.provenance.stats) errors.push(`${player.playerId}: dataQuality.historicalStats must match provenance.stats`);
    if (player.provenance.stats === "HISTORICAL_SNAPSHOT") {
      const sources = uniqueSources(statsSourceRefs, registry);
      const hasVerifiedStatsSource = sources.some((source) => source.status === "VERIFIED" && (source.kind === "OFFICIAL" || source.kind === "STATISTICAL"));
      if (!hasVerifiedStatsSource) errors.push(`${player.playerId}: historical statistics need a verified official or statistical source`);
    }
    const portraitReference = portraitSource ? registry[portraitSource] : undefined;
    if (player.assets.portrait.kind !== "GENERATED") {
      if (!portraitReference || portraitReference.kind !== "ASSET_LICENSE" || portraitReference.status !== "VERIFIED" || !portraitReference.license) {
        errors.push(`${player.playerId}: sourced portrait needs a verified asset-license source`);
      }
      if (player.dataQuality?.portrait && player.dataQuality.portrait !== "LICENSED") errors.push(`${player.playerId}: sourced portrait must be marked LICENSED`);
    } else if (player.dataQuality?.portrait === "LICENSED") {
      errors.push(`${player.playerId}: generated portrait cannot be marked LICENSED`);
    }
    const verifiedFieldRules: Array<[keyof NonNullable<Player["provenance"]["fieldSources"]>, PlayerFactStatus | undefined, PlayerSourceKind[]]> = [
      ["identity", player.dataQuality?.identity, ["OFFICIAL", "STATISTICAL"]],
      ["role", player.dataQuality?.role, ["OFFICIAL", "STATISTICAL"]],
      ["auction", player.dataQuality?.auctionTerms, ["OFFICIAL"]],
      ["availability", player.dataQuality?.availability, ["OFFICIAL", "EDITORIAL"]]
    ];
    verifiedFieldRules.forEach(([field, status, permittedKinds]) => {
      if (status !== "VERIFIED") return;
      const sourceId = player.provenance.fieldSources?.[field];
      const source = sourceId ? registry[sourceId] : undefined;
      if (!isSourceRecord(source) || source.status !== "VERIFIED" || !permittedKinds.includes(source.kind)) errors.push(`${player.playerId}: verified ${field} needs an eligible registered source`);
    });
  });

  return { valid: errors.length === 0, errors };
}

export function sourcesForPlayer(player: Player, registry: Record<string, PlayerSourceReference> = PLAYER_SOURCE_REGISTRY): PlayerSourceReference[] {
  return uniqueSources([
    ...(Array.isArray(player.provenance?.sourceRefs) ? player.provenance.sourceRefs : []),
    ...(Array.isArray(player.realData?.sourceRefs) ? player.realData.sourceRefs : []),
    ...Object.values(player.provenance?.fieldSources ?? {}).filter((sourceId): sourceId is string => typeof sourceId === "string")
  ], registry);
}

export function sourcesForPlayerField(player: Player, field: PlayerFactField, registry: Record<string, PlayerSourceReference> = PLAYER_SOURCE_REGISTRY): PlayerSourceReference[] {
  const provenanceField = field === "historicalStats" ? "stats" : field === "auctionTerms" ? "auction" : field;
  const sourceIds = field === "historicalStats"
    ? (Array.isArray(player.realData?.sourceRefs) ? player.realData.sourceRefs : Array.isArray(player.provenance?.sourceRefs) ? player.provenance.sourceRefs : [])
    : field === "portrait"
      ? [player.provenance?.fieldSources?.portrait ?? player.assets?.portrait?.sourceRef].filter((sourceId): sourceId is string => Boolean(sourceId))
    : [player.provenance?.fieldSources?.[provenanceField]].filter((sourceId): sourceId is string => Boolean(sourceId));
  return uniqueSources(sourceIds, registry);
}

/** A single disclosure rule prevents individual screens from overstating data. */
export function playerDataDisclosure(player: Player, registry: Record<string, PlayerSourceReference> = PLAYER_SOURCE_REGISTRY): PlayerDataDisclosure {
  const sources = sourcesForPlayerField(player, "historicalStats", registry);
  const statsStatus = player.realData?.dataStatus ?? player.provenance?.stats ?? "SIMULATION_GENERATED";
  const verified = statsStatus === "HISTORICAL_SNAPSHOT" && sources.some((source) => source.status === "VERIFIED" && (source.kind === "OFFICIAL" || source.kind === "STATISTICAL"));
  return verified
    ? { status: "VERIFIED", label: "Verified statistics", detail: `Historical snapshot${player.realData?.asOf ? ` (${player.realData.asOf})` : ""} backed by a registered cricket data source.`, sources }
    : { status: "PROJECTED", label: "Simulation inputs", detail: `Auction-balancing inputs generated by ${player.simulationData?.modelVersion ?? "the active simulation model"}; these figures are not an official IPL record.`, sources };
}

/** Field-level disclosure for scouting UI, imports and data-health tooling. */
export function playerFactDisclosure(player: Player, field: PlayerFactField, registry: Record<string, PlayerSourceReference> = PLAYER_SOURCE_REGISTRY): PlayerFactDisclosure {
  const quality = qualityForPlayer(player);
  const sources = sourcesForPlayerField(player, field, registry);
  const declaredStatus = quality[field];
  let status: PlayerFactDisclosure["status"];
  if (field === "historicalStats") status = playerDataDisclosure(player, registry).status;
  else if (field === "portrait") {
    status = player.assets?.portrait?.kind === "GENERATED"
      ? "GENERATED"
      : player.assets?.portrait?.kind === "LOCAL" || player.assets?.portrait?.kind === "REMOTE"
        ? hasEligibleVerifiedSource(sources, ["ASSET_LICENSE"], true) ? "LICENSED" : "UNAVAILABLE"
        : "UNAVAILABLE";
  } else if (declaredStatus === "VERIFIED") {
    const permittedKinds: PlayerSourceKind[] = field === "auctionTerms" ? ["OFFICIAL"] : field === "availability" ? ["OFFICIAL", "EDITORIAL"] : ["OFFICIAL", "STATISTICAL"];
    status = hasEligibleVerifiedSource(sources, permittedKinds) ? "VERIFIED" : "UNVERIFIED";
  } else {
    status = (["VERIFIED", "CURATED", "PROJECTED", "UNVERIFIED"] as const).includes(declaredStatus as PlayerFactStatus) ? declaredStatus as PlayerFactStatus : "UNVERIFIED";
  }
  const labels: Record<PlayerFactField, string> = {
    identity: status === "VERIFIED" ? "Verified identity" : status === "PROJECTED" ? "Generated prospect identity" : status === "UNVERIFIED" ? "Unverified identity" : "Curated identity",
    role: status === "VERIFIED" ? "Verified role" : status === "PROJECTED" ? "Projected role profile" : status === "UNVERIFIED" ? "Unverified role" : "Curated role profile",
    historicalStats: status === "VERIFIED" ? "Verified statistics" : "Projected performance line",
    auctionTerms: status === "VERIFIED" ? "Verified auction terms" : status === "UNVERIFIED" ? "Unverified auction terms" : "Projected auction terms",
    availability: status === "VERIFIED" ? "Verified availability" : status === "UNVERIFIED" ? "Unverified availability" : "Projected availability",
    portrait: status === "LICENSED" ? "Licensed portrait" : status === "UNAVAILABLE" ? "Portrait unavailable" : "Generated avatar"
  };
  const details: Record<PlayerFactField, string> = {
    identity: status === "VERIFIED" ? "Backed by a registered external source." : status === "PROJECTED" ? "Fictional academy identity used only by this simulation." : status === "UNVERIFIED" ? "A verified label was requested, but no eligible registered source is attached." : "Curated in the player pack and not independently verified in this build.",
    role: status === "VERIFIED" ? "Backed by a registered external source." : status === "UNVERIFIED" ? "A verified label was requested, but no eligible registered source is attached." : "Role details are part of the simulator dataset and may include projected defaults.",
    historicalStats: playerDataDisclosure(player, registry).detail,
    auctionTerms: status === "VERIFIED" ? "Backed by a registered official auction source." : status === "UNVERIFIED" ? "A verified label was requested, but no eligible official source is attached." : "Base price, category and RTM eligibility are scenario inputs for this ruleset.",
    availability: status === "VERIFIED" ? "Backed by a registered availability source." : status === "UNVERIFIED" ? "A verified label was requested, but no eligible availability source is attached." : "Availability is a scenario input and not a confirmed 2027 declaration.",
    portrait: status === "LICENSED" ? "The asset registry contains a usage-rights record." : status === "UNAVAILABLE" ? "No authorized portrait is bundled." : "Initials artwork is an original interface fallback, not player photography."
  };
  return { field, status, label: labels[field], detail: details[field], sources };
}

export function playerFactDisclosures(player: Player, registry: Record<string, PlayerSourceReference> = PLAYER_SOURCE_REGISTRY): PlayerFactDisclosure[] {
  return (["identity", "role", "historicalStats", "auctionTerms", "availability", "portrait"] as const)
    .map((field) => playerFactDisclosure(player, field, registry));
}

export function playerSourceCoverage(players: readonly Player[], registry: Record<string, PlayerSourceReference> = PLAYER_SOURCE_REGISTRY): PlayerSourceCoverage {
  const unresolvedSourceRefs = new Set<string>();
  let verifiedIdentities = 0;
  let curatedIdentities = 0;
  let projectedIdentities = 0;
  let generatedIdentities = 0;
  let unverifiedIdentities = 0;
  let verifiedStatSnapshots = 0;
  let verifiedAuctionTerms = 0;
  let verifiedAvailability = 0;
  let licensedPortraits = 0;
  let generatedPortraits = 0;
  let unavailablePortraits = 0;
  players.forEach((player) => {
    const quality = qualityForPlayer(player);
    const identityDisclosure = playerFactDisclosure(player, "identity", registry);
    const auctionDisclosure = playerFactDisclosure(player, "auctionTerms", registry);
    const availabilityDisclosure = playerFactDisclosure(player, "availability", registry);
    const portraitDisclosure = playerFactDisclosure(player, "portrait", registry);
    if (identityDisclosure.status === "VERIFIED") verifiedIdentities += 1;
    else if (identityDisclosure.status === "CURATED") curatedIdentities += 1;
    else if (identityDisclosure.status === "PROJECTED") projectedIdentities += 1;
    else unverifiedIdentities += 1;
    if (player.provenance.profile === "GENERATED") generatedIdentities += 1;
    if (playerDataDisclosure(player, registry).status === "VERIFIED") verifiedStatSnapshots += 1;
    if (auctionDisclosure.status === "VERIFIED") verifiedAuctionTerms += 1;
    if (availabilityDisclosure.status === "VERIFIED") verifiedAvailability += 1;
    if (portraitDisclosure.status === "LICENSED") licensedPortraits += 1;
    else if (portraitDisclosure.status === "GENERATED") generatedPortraits += 1;
    else unavailablePortraits += 1;
    [...(Array.isArray(player.provenance?.sourceRefs) ? player.provenance.sourceRefs : []), ...(Array.isArray(player.realData?.sourceRefs) ? player.realData.sourceRefs : []), ...Object.values(player.provenance?.fieldSources ?? {}).filter((sourceId): sourceId is string => typeof sourceId === "string")]
      .forEach((sourceId) => { if (!registry[sourceId]) unresolvedSourceRefs.add(sourceId); });
  });
  return {
    playerCount: players.length,
    verifiedIdentities,
    curatedIdentities,
    projectedIdentities,
    generatedIdentities,
    unverifiedIdentities,
    verifiedStatSnapshots,
    projectedStatSnapshots: players.length - verifiedStatSnapshots,
    verifiedAuctionTerms,
    verifiedAvailability,
    licensedPortraits,
    generatedPortraits,
    unavailablePortraits,
    unresolvedSourceRefs: [...unresolvedSourceRefs].sort()
  };
}

/**
 * Returns a compact registry health report for build diagnostics and future
 * admin/import screens. It is intentionally independent of player records so
 * a bad source manifest can fail CI before any auction is started.
 */
export function validateSourceRegistry(registry: Record<string, PlayerSourceReference> = PLAYER_SOURCE_REGISTRY): SourceReferenceValidation {
  return validatePlayerSourceReferences([], registry);
}
