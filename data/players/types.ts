export const PLAYER_ROLES = ["BAT", "BOWL", "AR", "WK"] as const;
export type Role = (typeof PLAYER_ROLES)[number];

export const AUCTION_CATEGORIES = [
  "MARQUEE",
  "CAPPED_INDIAN",
  "CAPPED_OVERSEAS",
  "UNCAPPED",
  "ACCELERATED"
] as const;
export type AuctionCategory = (typeof AUCTION_CATEGORIES)[number];

export type CappedStatus = "CAPPED" | "UNCAPPED";
export type NationalityStatus = "INDIAN" | "OVERSEAS";
export type AvailabilityStatus = "FULL" | "PARTIAL" | "DOUBTFUL";
export type FormTrend = "RISING" | "STABLE" | "DECLINING";
export type PlayerProfileSource = "CURATED" | "GENERATED";
export type PlayerStatsSource = "HISTORICAL_SNAPSHOT" | "SIMULATION_GENERATED";
/**
 * A curated label is useful product data, but it is not the same claim as a
 * fact independently verified by a registered source. These quality markers
 * let presentation code make that distinction without inspecting raw source
 * records on every render.
 */
export type PlayerFactStatus = "VERIFIED" | "CURATED" | "PROJECTED" | "UNVERIFIED";
export type PlayerPortraitDataStatus = "LICENSED" | "GENERATED" | "UNAVAILABLE";
export type PlayerDataQuality = {
  identity: PlayerFactStatus;
  role: PlayerFactStatus;
  historicalStats: PlayerStatsSource;
  auctionTerms: PlayerFactStatus;
  availability: PlayerFactStatus;
  portrait: PlayerPortraitDataStatus;
  /** Optional ISO date/season marker supplied by an ingestion pipeline. */
  asOf?: string;
  /** Human-readable caveats suitable for the scouting drawer. */
  notes?: string[];
};
/**
 * Portrait assets are deliberately separated from player facts. A generated
 * avatar is an original UI treatment; it must never be presented as a real
 * photograph. When licensed/local artwork is added, the manifest can switch
 * the asset kind without changing auction or UI code.
 */
export type PlayerPortraitKind = "LOCAL" | "REMOTE" | "GENERATED";
export type PlayerPortraitFallback = "INITIALS" | "SILHOUETTE";
export type PlayerPortraitAsset = {
  kind: PlayerPortraitKind;
  /** Null for generated assets and for an unavailable optional portrait. */
  src: string | null;
  alt: string;
  fallback: PlayerPortraitFallback;
  /** Human-readable provenance key, not a claim that the image is official. */
  sourceRef?: string;
  /** License/usage note for an externally supplied asset. */
  license?: string;
};
export type PlayerAssets = {
  manifestVersion: string;
  portrait: PlayerPortraitAsset;
};

export type Player = {
  playerId: string;
  identity: {
    name: string;
    shortName: string;
    nationality: string;
    age: number;
    imageSlug: string;
  };
  assets: PlayerAssets;
  role: {
    primary: Role;
    battingStyle: string;
    bowlingStyle?: string;
    specialization?: string;
  };
  realData: {
    iplMatches: number;
    runs: number;
    wickets: number;
    battingAverage?: number;
    /** @deprecated Use battingAverage. Kept for compatibility with early UI consumers. */
    average?: number;
    strikeRate?: number;
    bowlingAverage?: number;
    economy?: number;
    bestBowling?: string;
    catches?: number;
    stumpings?: number;
    /** Mirrors provenance.stats for consumers rendering this snapshot alone. */
    dataStatus?: PlayerStatsSource;
    /** Source season/date when this snapshot is independently imported. */
    asOf?: string;
    /** Source IDs specifically backing this snapshot. */
    sourceRefs?: string[];
  };
  auctionData: {
    basePrice: number;
    cappedStatus: CappedStatus;
    nationalityStatus: NationalityStatus;
    category: AuctionCategory;
    rtmEligible: boolean;
    availability: AvailabilityStatus;
  };
  simulationData: {
    modelVersion: string;
    overall: number;
    potential: number;
    consistency: number;
    pressure: number;
    injuryRisk: number;
    formTrend: FormTrend;
    /** Retained for compatibility with the existing development UI. */
    developmentRate: number;
  };
  valuation: {
    fairValue: number;
    confidence: number;
    scarcity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    reason: string;
  };
  provenance: {
    profile: PlayerProfileSource;
    stats: PlayerStatsSource;
    datasetVersion: string;
    sourceRefs: string[];
    /** Optional field-level source mapping from an ingestion pipeline. */
    fieldSources?: Partial<Record<"identity" | "role" | "stats" | "auction" | "availability" | "portrait", string>>;
  };
  /** Explicit quality metadata; absent only on legacy imported records. */
  dataQuality?: PlayerDataQuality;
};

export type PlayerDatasetValidation = {
  valid: boolean;
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasOnlyKnownValue<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

export function validatePlayerDataset(players: unknown, expectedDatasetVersion?: string): PlayerDatasetValidation {
  const errors: string[] = [];
  if (!Array.isArray(players)) return { valid: false, errors: ["Player dataset must be an array"] };
  const ids = new Set<string>();
  const imageSlugs = new Set<string>();

  players.forEach((rawPlayer, index) => {
    const raw = isRecord(rawPlayer) ? rawPlayer : {};
    const rawId = typeof raw.playerId === "string" ? raw.playerId : "missing-id";
    const path = `players[${index}] (${rawId || "missing-id"})`;
    if (!isRecord(rawPlayer)) {
      errors.push(`${path}: player must be an object`);
      return;
    }

    const playerId = raw.playerId;
    if (typeof playerId !== "string" || !playerId.trim()) errors.push(`${path}: playerId is required`);
    else if (ids.has(playerId)) errors.push(`${path}: duplicate playerId`);
    else ids.add(playerId);

    const identity = raw.identity;
    const assets = raw.assets;
    const role = raw.role;
    const realData = raw.realData;
    const auctionData = raw.auctionData;
    const simulationData = raw.simulationData;
    const valuation = raw.valuation;
    const provenance = raw.provenance;
    const dataQuality = raw.dataQuality;
    if (!isRecord(identity)) { errors.push(`${path}: identity is required`); return; }
    if (!isRecord(role)) { errors.push(`${path}: role is required`); return; }
    if (!isRecord(realData)) { errors.push(`${path}: realData is required`); return; }
    if (!isRecord(auctionData)) { errors.push(`${path}: auctionData is required`); return; }
    if (!isRecord(simulationData)) { errors.push(`${path}: simulationData is required`); return; }
    if (!isRecord(valuation)) { errors.push(`${path}: valuation is required`); return; }
    if (!isRecord(provenance)) { errors.push(`${path}: provenance is required`); return; }
    if (!isRecord(assets)) {
      errors.push(`${path}: assets are required`);
    } else {
      if (typeof assets.manifestVersion !== "string" || !assets.manifestVersion.trim()) errors.push(`${path}: assets.manifestVersion is required`);
      const portrait = assets.portrait;
      if (!isRecord(portrait)) {
        errors.push(`${path}: assets.portrait is required`);
      } else {
        if (!hasOnlyKnownValue(portrait.kind, ["LOCAL", "REMOTE", "GENERATED"] as const)) errors.push(`${path}: invalid portrait asset kind`);
        if (portrait.src !== null && typeof portrait.src !== "string") errors.push(`${path}: portrait src must be a string or null`);
        if (typeof portrait.alt !== "string" || !portrait.alt.trim()) errors.push(`${path}: portrait alt is required`);
        if (!hasOnlyKnownValue(portrait.fallback, ["INITIALS", "SILHOUETTE"] as const)) errors.push(`${path}: invalid portrait fallback`);
        if (portrait.kind === "GENERATED" && portrait.src !== null) errors.push(`${path}: generated portrait must not contain a source URL`);
        if ((portrait.kind === "LOCAL" || portrait.kind === "REMOTE") && (typeof portrait.src !== "string" || !portrait.src.trim())) errors.push(`${path}: sourced portrait must contain a source URL`);
        if (portrait.kind === "REMOTE" && typeof portrait.src === "string" && !portrait.src.startsWith("https://")) errors.push(`${path}: remote portrait must use HTTPS`);
        if (portrait.kind === "LOCAL" && typeof portrait.src === "string" && (!/^\/assets\/players\/[a-z0-9][a-z0-9/_-]*\.(avif|webp|png|jpe?g)$/i.test(portrait.src) || portrait.src.includes(".."))) errors.push(`${path}: local portrait must be a supported file under /assets/players`);
        if ((portrait.kind === "LOCAL" || portrait.kind === "REMOTE") && (typeof portrait.sourceRef !== "string" || !portrait.sourceRef.trim())) errors.push(`${path}: sourced portrait needs a sourceRef`);
        if ((portrait.kind === "LOCAL" || portrait.kind === "REMOTE") && (typeof portrait.license !== "string" || !portrait.license.trim())) errors.push(`${path}: sourced portrait needs a license note`);
        if (portrait.sourceRef !== undefined && typeof portrait.sourceRef !== "string") errors.push(`${path}: portrait sourceRef must be a string`);
        if (portrait.license !== undefined && typeof portrait.license !== "string") errors.push(`${path}: portrait license must be a string`);
      }
    }

    const name = identity.name;
    const imageSlug = identity.imageSlug;
    if (typeof name !== "string" || !name.trim()) errors.push(`${path}: name is required`);
    if (typeof imageSlug !== "string" || !imageSlug.trim()) errors.push(`${path}: imageSlug is required`);
    else if (imageSlugs.has(imageSlug)) errors.push(`${path}: duplicate imageSlug`);
    else imageSlugs.add(imageSlug);
    if (typeof identity.shortName !== "string" || !identity.shortName.trim()) errors.push(`${path}: shortName is required`);
    if (typeof identity.nationality !== "string" || !identity.nationality.trim()) errors.push(`${path}: nationality is required`);
    if (!isFiniteNumber(identity.age) || identity.age < 18 || identity.age > 45) errors.push(`${path}: age must be between 18 and 45`);

    if (!hasOnlyKnownValue(role.primary, PLAYER_ROLES)) errors.push(`${path}: invalid role`);
    if (typeof role.battingStyle !== "string" || !role.battingStyle.trim()) errors.push(`${path}: battingStyle is required`);
    (["bowlingStyle", "specialization"] as const).forEach((field) => {
      if (role[field] !== undefined && typeof role[field] !== "string") errors.push(`${path}: role.${field} must be a string`);
    });

    (["iplMatches", "runs", "wickets"] as const).forEach((field) => {
      if (!isFiniteNumber(realData[field]) || realData[field] < 0) errors.push(`${path}: realData.${field} must be a non-negative finite number`);
    });
    (["battingAverage", "average", "strikeRate", "bowlingAverage", "economy", "catches", "stumpings"] as const).forEach((field) => {
      if (realData[field] !== undefined && (!isFiniteNumber(realData[field]) || realData[field] < 0)) errors.push(`${path}: realData.${field} must be a non-negative finite number`);
    });
    if (realData.bestBowling !== undefined && typeof realData.bestBowling !== "string") errors.push(`${path}: realData.bestBowling must be a string`);
    if (realData.dataStatus !== undefined && !hasOnlyKnownValue(realData.dataStatus, ["HISTORICAL_SNAPSHOT", "SIMULATION_GENERATED"] as const)) errors.push(`${path}: realData.dataStatus is invalid`);
    if (realData.asOf !== undefined && (typeof realData.asOf !== "string" || !realData.asOf.trim())) errors.push(`${path}: realData.asOf must be a non-empty string`);
    if (realData.sourceRefs !== undefined && (!Array.isArray(realData.sourceRefs) || realData.sourceRefs.some((sourceRef) => typeof sourceRef !== "string" || !sourceRef.trim()))) errors.push(`${path}: realData.sourceRefs must be a string array`);

    if (!isFiniteNumber(auctionData.basePrice) || auctionData.basePrice <= 0) errors.push(`${path}: basePrice must be positive`);
    if (!hasOnlyKnownValue(auctionData.cappedStatus, ["CAPPED", "UNCAPPED"] as const)) errors.push(`${path}: invalid capped status`);
    if (!hasOnlyKnownValue(auctionData.nationalityStatus, ["INDIAN", "OVERSEAS"] as const)) errors.push(`${path}: invalid nationality status`);
    if (!hasOnlyKnownValue(auctionData.category, AUCTION_CATEGORIES)) errors.push(`${path}: invalid category`);
    if (typeof auctionData.rtmEligible !== "boolean") errors.push(`${path}: rtmEligible must be boolean`);
    if (!hasOnlyKnownValue(auctionData.availability, ["FULL", "PARTIAL", "DOUBTFUL"] as const)) errors.push(`${path}: invalid availability`);

    if (typeof simulationData.modelVersion !== "string" || !simulationData.modelVersion.trim()) errors.push(`${path}: simulationData.modelVersion is required`);
    (["overall", "potential", "consistency", "pressure", "injuryRisk", "developmentRate"] as const).forEach((field) => {
      if (!isFiniteNumber(simulationData[field]) || simulationData[field] < 0 || simulationData[field] > 100) errors.push(`${path}: simulationData.${field} must be between 0 and 100`);
    });
    if (!hasOnlyKnownValue(simulationData.formTrend, ["RISING", "STABLE", "DECLINING"] as const)) errors.push(`${path}: invalid form trend`);

    if (!isFiniteNumber(valuation.fairValue) || !isFiniteNumber(auctionData.basePrice) || valuation.fairValue < auctionData.basePrice) errors.push(`${path}: fairValue cannot be below basePrice`);
    if (!isFiniteNumber(valuation.confidence) || valuation.confidence < 0 || valuation.confidence > 100) errors.push(`${path}: valuation.confidence must be between 0 and 100`);
    if (!hasOnlyKnownValue(valuation.scarcity, ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const)) errors.push(`${path}: invalid scarcity`);
    if (typeof valuation.reason !== "string" || !valuation.reason.trim()) errors.push(`${path}: valuation.reason is required`);

    if (!hasOnlyKnownValue(provenance.profile, ["CURATED", "GENERATED"] as const)) errors.push(`${path}: invalid profile provenance`);
    if (!hasOnlyKnownValue(provenance.stats, ["HISTORICAL_SNAPSHOT", "SIMULATION_GENERATED"] as const)) errors.push(`${path}: invalid stats provenance`);
    if (typeof provenance.datasetVersion !== "string" || !provenance.datasetVersion.trim()) errors.push(`${path}: provenance datasetVersion is required`);
    else if (expectedDatasetVersion && provenance.datasetVersion !== expectedDatasetVersion) errors.push(`${path}: provenance datasetVersion does not match ${expectedDatasetVersion}`);
    if (!Array.isArray(provenance.sourceRefs) || provenance.sourceRefs.some((sourceRef) => typeof sourceRef !== "string" || !sourceRef.trim())) errors.push(`${path}: provenance sourceRefs must be a string array`);
    if (provenance.fieldSources !== undefined && (!isRecord(provenance.fieldSources) || Object.values(provenance.fieldSources).some((sourceRef) => typeof sourceRef !== "string" || !sourceRef.trim()))) errors.push(`${path}: provenance.fieldSources must map fields to source IDs`);
    if (provenance.profile === "GENERATED" && provenance.stats !== "SIMULATION_GENERATED") errors.push(`${path}: generated profiles cannot claim historical statistics`);

    if (dataQuality !== undefined) {
      if (!isRecord(dataQuality)) errors.push(`${path}: dataQuality must be an object`);
      else {
        if (!hasOnlyKnownValue(dataQuality.identity, ["VERIFIED", "CURATED", "PROJECTED", "UNVERIFIED"] as const)) errors.push(`${path}: dataQuality.identity is invalid`);
        if (!hasOnlyKnownValue(dataQuality.role, ["VERIFIED", "CURATED", "PROJECTED", "UNVERIFIED"] as const)) errors.push(`${path}: dataQuality.role is invalid`);
        if (!hasOnlyKnownValue(dataQuality.historicalStats, ["HISTORICAL_SNAPSHOT", "SIMULATION_GENERATED"] as const)) errors.push(`${path}: dataQuality.historicalStats is invalid`);
        if (!hasOnlyKnownValue(dataQuality.auctionTerms, ["VERIFIED", "CURATED", "PROJECTED", "UNVERIFIED"] as const)) errors.push(`${path}: dataQuality.auctionTerms is invalid`);
        if (!hasOnlyKnownValue(dataQuality.availability, ["VERIFIED", "CURATED", "PROJECTED", "UNVERIFIED"] as const)) errors.push(`${path}: dataQuality.availability is invalid`);
        if (!hasOnlyKnownValue(dataQuality.portrait, ["LICENSED", "GENERATED", "UNAVAILABLE"] as const)) errors.push(`${path}: dataQuality.portrait is invalid`);
        if (dataQuality.asOf !== undefined && (typeof dataQuality.asOf !== "string" || !dataQuality.asOf.trim())) errors.push(`${path}: dataQuality.asOf must be a non-empty string`);
        if (dataQuality.notes !== undefined && (!Array.isArray(dataQuality.notes) || dataQuality.notes.some((note) => typeof note !== "string" || !note.trim()))) errors.push(`${path}: dataQuality.notes must be a string array`);
      }
    }

    if (identity.nationality === "Indian" && auctionData.nationalityStatus !== "INDIAN") errors.push(`${path}: nationalityStatus does not match nationality`);
    if (identity.nationality !== "Indian" && auctionData.nationalityStatus !== "OVERSEAS") errors.push(`${path}: nationalityStatus does not match nationality`);
    if (auctionData.cappedStatus === "UNCAPPED" && !["UNCAPPED", "ACCELERATED"].includes(auctionData.category as string)) errors.push(`${path}: uncapped player must use UNCAPPED or ACCELERATED category`);
  });

  return { valid: errors.length === 0, errors };
}
