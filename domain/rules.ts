import { AUCTION_CATEGORIES, type AuctionCategory } from "@/data/players/types";

export type RuleSetStatus = "OFFICIAL" | "PROJECTED" | "CUSTOM";

export type RuleSetSnapshot = {
  schemaVersion: 1;
  id: string;
  version: string;
  status: RuleSetStatus;
  updatedAt: string;
  dataVersion: string;
  simulationModelVersion: string;
  auction: {
    startingPurse: number;
    maxSquadSize: number;
    minSquadSize: number;
    maxOverseas: number;
    categoryOrder: readonly AuctionCategory[];
    acceleratedEnabled: boolean;
    bidIncrementBands: readonly { below: number; increment: number }[];
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

export function validateRuleSetSnapshot(snapshot: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(snapshot)) return ["Rules snapshot must be an object"];
  if (snapshot.schemaVersion !== 1) errors.push("Unsupported rules snapshot schema");
  if (typeof snapshot.id !== "string" || !snapshot.id.trim() || typeof snapshot.version !== "string" || !snapshot.version.trim()) errors.push("Rules snapshot id and version are required");
  if (!isRecord(snapshot.auction)) {
    errors.push("Auction rules are required");
    return errors;
  }
  if (snapshot.status !== "OFFICIAL" && snapshot.status !== "PROJECTED" && snapshot.status !== "CUSTOM") errors.push("Rules snapshot status is invalid");
  if (typeof snapshot.updatedAt !== "string" || Number.isNaN(Date.parse(snapshot.updatedAt))) errors.push("Rules snapshot updatedAt must be a valid date");
  if (typeof snapshot.dataVersion !== "string" || !snapshot.dataVersion.trim() || typeof snapshot.simulationModelVersion !== "string" || !snapshot.simulationModelVersion.trim()) errors.push("Data and simulation model versions are required");

  const auction = snapshot.auction;
  if (!isFiniteNumber(auction.startingPurse) || auction.startingPurse <= 0) errors.push("Starting purse must be positive");
  const maxSquadSize = auction.maxSquadSize;
  const minSquadSize = auction.minSquadSize;
  const maxOverseas = auction.maxOverseas;
  if (!isInteger(maxSquadSize) || !isInteger(minSquadSize) || minSquadSize < 1 || maxSquadSize < minSquadSize) errors.push("Squad size bounds are invalid");
  if (!isInteger(maxOverseas) || maxOverseas < 0 || maxOverseas > (isFiniteNumber(maxSquadSize) ? maxSquadSize : 0)) errors.push("Overseas limit is invalid");
  if (typeof auction.acceleratedEnabled !== "boolean") errors.push("Accelerated-round flag is invalid");

  if (!Array.isArray(auction.categoryOrder) || auction.categoryOrder.length === 0) {
    errors.push("Auction category order cannot be empty");
  } else {
    const categories = auction.categoryOrder;
    if (categories.some((category) => !AUCTION_CATEGORIES.includes(category as AuctionCategory))) errors.push("Auction category order contains an invalid category");
    if (new Set(categories).size !== categories.length) errors.push("Auction category order contains duplicates");
    if (auction.acceleratedEnabled && !categories.includes("ACCELERATED")) errors.push("Accelerated category must be present when enabled");
  }

  if (!Array.isArray(auction.bidIncrementBands) || auction.bidIncrementBands.length === 0) {
    errors.push("Bid increment bands cannot be empty");
  } else {
    let previousBelow = -Infinity;
    auction.bidIncrementBands.forEach((band, index) => {
      if (!isRecord(band) || !isFiniteNumber(band.below) || !isFiniteNumber(band.increment) || band.below <= 0 || band.increment <= 0) {
        errors.push(`Bid increment band ${index} is invalid`);
      } else if (band.below <= previousBelow) {
        errors.push("Bid increment bands must be strictly increasing");
      }
      if (isFiniteNumber(band.below)) previousBelow = band.below;
    });
  }
  return errors;
}
