import type { Role } from "@/data/players/types";
import { FRANCHISE_IDS, type FranchiseId } from "@/data/teams/franchises";

/**
 * Data-driven franchise behaviour used by the auction market model.
 * Values are simulation tuning inputs, not claims about real organisations.
 */
export type FranchiseMarketProfile = {
  franchiseId: FranchiseId;
  aggression: number;
  valueDiscipline: number;
  volatility: number;
  youthBias: number;
  experienceBias: number;
  indianCoreBias: number;
  overseasBias: number;
  reservePerOpenSlot: number;
  rolePriority: Record<Role, number>;
};

export const FRANCHISE_MARKET_PROFILES: Record<FranchiseId, FranchiseMarketProfile> = {
  KKR: profile("KKR", 1.08, 1.02, 0.08, 1.03, 1, 1.03, 1, 0.22, { BAT: 0.98, BOWL: 1.1, AR: 1.08, WK: 0.98 }),
  MI: profile("MI", 1.1, 0.99, 0.1, 1.08, 1.02, 1.1, 0.98, 0.2, { BAT: 1.07, BOWL: 1.08, AR: 1.02, WK: 0.98 }),
  RCB: profile("RCB", 1.12, 0.96, 0.13, 1, 1.05, 1.02, 1.01, 0.2, { BAT: 1.08, BOWL: 1.13, AR: 1, WK: 0.97 }),
  CSK: profile("CSK", 0.98, 1.1, 0.05, 0.94, 1.13, 1.04, 1.02, 0.25, { BAT: 1, BOWL: 1.06, AR: 1.09, WK: 1.02 }),
  SRH: profile("SRH", 1.15, 0.94, 0.15, 1.02, 1.01, 0.98, 1.08, 0.18, { BAT: 1.1, BOWL: 1.09, AR: 1.03, WK: 1.02 }),
  RR: profile("RR", 0.99, 1.12, 0.06, 1.14, 0.91, 1.05, 0.98, 0.28, { BAT: 1.05, BOWL: 1.02, AR: 1.08, WK: 1.03 }),
  DC: profile("DC", 1.06, 1, 0.11, 1.09, 0.96, 1.06, 0.99, 0.22, { BAT: 1.08, BOWL: 1.02, AR: 1.05, WK: 1.04 }),
  PBKS: profile("PBKS", 1.16, 0.93, 0.16, 1.04, 0.98, 1.01, 1.03, 0.17, { BAT: 1.08, BOWL: 1.06, AR: 1.04, WK: 1.1 }),
  LSG: profile("LSG", 1.04, 1.04, 0.08, 1.03, 1.01, 1, 1.05, 0.23, { BAT: 1.04, BOWL: 1.07, AR: 1.1, WK: 1 }),
  GT: profile("GT", 0.97, 1.13, 0.04, 1.02, 1.05, 1.04, 0.99, 0.3, { BAT: 1.01, BOWL: 1.09, AR: 1.04, WK: 1.04 })
};

function profile(
  franchiseId: FranchiseId,
  aggression: number,
  valueDiscipline: number,
  volatility: number,
  youthBias: number,
  experienceBias: number,
  indianCoreBias: number,
  overseasBias: number,
  reservePerOpenSlot: number,
  rolePriority: Record<Role, number>
): FranchiseMarketProfile {
  return { franchiseId, aggression, valueDiscipline, volatility, youthBias, experienceBias, indianCoreBias, overseasBias, reservePerOpenSlot, rolePriority };
}

if (Object.keys(FRANCHISE_MARKET_PROFILES).length !== FRANCHISE_IDS.length) {
  throw new Error("Every franchise must have a market profile.");
}
