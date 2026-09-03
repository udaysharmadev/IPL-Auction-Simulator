export type RuleSection = {
  id: "FORMAT" | "MONEY" | "SQUAD" | "RETENTION" | "INTEGRITY";
  number: string;
  title: string;
  shortTitle: string;
  summary: string;
  points: { label: string; value: string; note: string }[];
};

import { validateRuleSetSnapshot, type RuleSetSnapshot } from "@/domain/rules";
import { AUCTION_CATEGORY_ORDER } from "@/data/auction/categoryOrder";
import { PLAYER_DATASET_VERSION } from "@/data/players/2027";

export const RULE_SET = {
  id: "ipl-2027-projected",
  version: "2027-PROJECTED-v1",
  status: "PROJECTED" as const,
  updatedAt: "2026-08-23",
  label: "2027 Auction Framework",
  sections: [
    {
      id: "FORMAT", number: "01", title: "Auction format", shortTitle: "Format",
      summary: "Players enter in structured sets. Marquee players open the market before role-based and accelerated rounds.",
      points: [
        { label: "Auction type", value: "Mega-style", note: "Configurable simulation framework" },
        { label: "Franchises", value: "10", note: "One user and nine intelligent rivals" },
        { label: "Player order", value: "Seeded", note: "Reproducible for replay and debugging" }
      ]
    },
    {
      id: "MONEY", number: "02", title: "Purse & bidding", shortTitle: "Money",
      summary: "Every purchase permanently reduces the available purse. Bid increments change as prices rise.",
      points: [
        { label: "Starting purse", value: "₹50 Cr", note: "Simulation ruleset value" },
        { label: "Opening bands", value: "₹0.25 Cr", note: "Increases at higher bid levels" },
        { label: "Budget safety", value: "Enforced", note: "No franchise can spend below zero" }
      ]
    },
    {
      id: "SQUAD", number: "03", title: "Squad construction", shortTitle: "Squad",
      summary: "A legal squad needs role coverage, sufficient depth and compliance with overseas-player limits.",
      points: [
        { label: "Maximum squad", value: "25", note: "Configurable by ruleset" },
        { label: "Minimum squad", value: "12", note: "MVP simulation threshold" },
        { label: "Overseas cap", value: "8", note: "Squad-level maximum" }
      ]
    },
    {
      id: "RETENTION", number: "04", title: "Retentions & RTM", shortTitle: "Retention",
      summary: "Retention and Right-to-Match mechanics are ruleset capabilities. They activate only when the selected format supports them.",
      points: [
        { label: "Retained core", value: "Scenario based", note: "Changes team purse and needs" },
        { label: "RTM", value: "Rules controlled", note: "Never hardcoded in UI" },
        { label: "Purse deductions", value: "Versioned", note: "Stored with source metadata" }
      ]
    },
    {
      id: "INTEGRITY", number: "05", title: "Data & game integrity", shortTitle: "Integrity",
      summary: "Verified cricket facts and simulation projections are separate. Unknown 2027 information is never presented as confirmed.",
      points: [
        { label: "Current status", value: "Projected", note: "Awaiting final official 2027 rules" },
        { label: "Simulation values", value: "Clearly labeled", note: "Ratings, potential and fair value" },
        { label: "Save compatibility", value: "Versioned", note: "Rules and data versions travel with saves" }
      ]
    }
  ] satisfies RuleSection[]
};

/** Immutable metadata carried by every deterministic auction state/save. */
export const RULE_SET_SNAPSHOT: RuleSetSnapshot = {
  schemaVersion: 1,
  id: RULE_SET.id,
  version: RULE_SET.version,
  status: RULE_SET.status,
  updatedAt: RULE_SET.updatedAt,
  dataVersion: PLAYER_DATASET_VERSION,
  simulationModelVersion: "valuation-v1",
  auction: {
    startingPurse: 50,
    maxSquadSize: 25,
    minSquadSize: 12,
    maxOverseas: 8,
    categoryOrder: AUCTION_CATEGORY_ORDER,
    acceleratedEnabled: true,
    bidIncrementBands: [
      { below: 5, increment: 0.25 },
      { below: 10, increment: 0.5 },
      // A finite sentinel keeps the snapshot JSON-safe for IndexedDB/local
      // fallback serialization while still covering every practical bid.
      { below: Number.MAX_SAFE_INTEGER, increment: 1 }
    ]
  }
};

const RULE_SET_VALIDATION_ERRORS = validateRuleSetSnapshot(RULE_SET_SNAPSHOT);
if (RULE_SET_VALIDATION_ERRORS.length > 0) {
  throw new Error(`Invalid ${RULE_SET_SNAPSHOT.version} rules snapshot: ${RULE_SET_VALIDATION_ERRORS.join("; ")}`);
}
