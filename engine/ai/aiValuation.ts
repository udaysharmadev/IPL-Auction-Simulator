import type { Role, Player } from "@/data/players/types";
import type { FranchiseMarketProfile } from "@/data/teams/marketProfiles";
import { buildRoleNeeds, type SquadRulesConfig } from "@/engine/squad/squadRules";

export type AiValuationContext = {
  squad: readonly string[];
  budget: number;
  remainingPlayers?: readonly Player[];
  players: readonly Player[];
  rules?: SquadRulesConfig;
  strategy?: FranchiseMarketProfile;
};

export type ContextualValuation = {
  fairValue: number;
  needScore: number;
  scarcityScore: number;
  budgetPressure: number;
  confidence: number;
  reason: string;
};

const roleNames: Record<Role, string> = { BAT: "batting", BOWL: "bowling", AR: "all-rounder", WK: "wicketkeeping" };

export function roleNeedScore(squad: readonly string[], role: Role, players: readonly Player[], rules?: SquadRulesConfig): number {
  return buildRoleNeeds(squad, players, rules).find((need) => need.role === role)?.count ?? 0;
}

export function contextualValuation(player: Player, context: AiValuationContext): ContextualValuation {
  const strategy = context.strategy;
  const needScore = roleNeedScore(context.squad, player.role.primary, context.players, context.rules);
  const remaining = context.remainingPlayers ?? context.players;
  const viableAlternatives = remaining.filter((candidate) => candidate.playerId !== player.playerId && candidate.role.primary === player.role.primary).length;
  const scarcityScore = viableAlternatives <= 1 ? 2.8 : viableAlternatives <= 3 ? 1.8 : viableAlternatives <= 7 ? 0.8 : 0.2;
  const budgetPressure = Math.max(0, 8 - context.budget) * 0.2;
  const needBoost = needScore * 0.6;
  const formBoost = player.simulationData.formTrend === "RISING" ? 0.25 : player.simulationData.formTrend === "DECLINING" ? -0.2 : 0;
  const ageRisk = player.identity.age > 34 ? 0.25 : 0;
  const roleFactor = strategy?.rolePriority[player.role.primary] ?? 1;
  const ageFactor = player.identity.age <= 25 ? strategy?.youthBias ?? 1 : player.identity.age >= 31 ? strategy?.experienceBias ?? 1 : 1;
  const nationalityFactor = player.auctionData.nationalityStatus === "INDIAN" ? strategy?.indianCoreBias ?? 1 : strategy?.overseasBias ?? 1;
  const identityAdjustment = player.valuation.fairValue * (roleFactor * ageFactor * nationalityFactor - 1) * 0.55;
  const fairValue = Math.max(player.auctionData.basePrice, Number((player.valuation.fairValue + needBoost + scarcityScore + formBoost + identityAdjustment - budgetPressure - ageRisk).toFixed(2)));
  const confidence = Math.max(0, Math.min(100, player.valuation.confidence - (player.provenance.stats === "SIMULATION_GENERATED" ? 8 : 0)));
  const fit = roleFactor >= 1.07 ? "a franchise-priority role" : needScore > 2 ? "a critical squad gap" : "a useful structural fit";
  return { fairValue, needScore, scarcityScore, budgetPressure, confidence, reason: `${roleNames[player.role.primary]} fit with ${fit}; ${viableAlternatives} alternatives remain.` };
}
