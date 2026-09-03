import type { Player } from "@/data/players/types";
import { contextualValuation, type AiValuationContext, type ContextualValuation } from "@/engine/ai/aiValuation";
import type { SeededRng } from "@/engine/random/seededRng";
import { canAddPlayer, type SquadRulesConfig } from "@/engine/squad/squadRules";
import { aiDifficultyProfile, type AiDifficultyProfile } from "@/engine/ai/difficulty";

export type AiBidderContext = AiValuationContext & {
  player: Player;
  currentBid: number;
  candidates: number;
  rules: SquadRulesConfig;
  bidIncrementBands?: readonly { below: number; increment: number }[];
  reserveRequired?: number;
  difficulty?: AiDifficultyProfile;
  rng: SeededRng;
};

export type AiPsychology = "CALM" | "INTERESTED" | "COMPETING" | "AGGRESSIVE" | "CONCERNED" | "PANICKING";

export type AiBidDecision = {
  shouldBid: boolean;
  bid: number;
  maxBid: number;
  valuation: ContextualValuation;
  psychology: AiPsychology;
  confidence: number;
};

function increment(bid: number, bands: AiBidderContext["bidIncrementBands"]) {
  return bands?.find((band) => bid < band.below)?.increment ?? (bid < 5 ? 0.25 : bid < 10 ? 0.5 : 1);
}

export function decideAiBid(context: AiBidderContext): AiBidDecision {
  const valuation = contextualValuation(context.player, context);
  const strategy = context.strategy;
  const difficulty = context.difficulty ?? aiDifficultyProfile("STRATEGIST");
  const marketPressure = Math.min(1.8, Math.max(0, context.candidates - 1) * 0.14) * difficulty.marketAwareness;
  const volatility = (strategy?.volatility ?? 0.08) * difficulty.valuationNoise;
  const variance = Number(((context.rng.next() - 0.5) * volatility * Math.max(2, valuation.fairValue)).toFixed(2));
  const strategyValue = valuation.fairValue * ((strategy?.aggression ?? 1) / (strategy?.valueDiscipline ?? 1));
  const spendableBudget = Math.max(0, context.budget - (context.reserveRequired ?? 0));
  const maxBid = Math.max(0, Math.min(spendableBudget, Number((strategyValue + marketPressure + variance).toFixed(2))));
  const bid = context.currentBid === 0 ? context.player.auctionData.basePrice : Number((context.currentBid + increment(context.currentBid, context.bidIncrementBands)).toFixed(2));
  const shouldBid = canAddPlayer(context.squad, context.player, context.rules, context.players) && bid <= spendableBudget && bid <= maxBid;
  const psychology: AiPsychology = spendableBudget < 5 && valuation.needScore > 2 ? "PANICKING" : valuation.needScore > 2 && (strategy?.aggression ?? 1) >= 1.05 ? "AGGRESSIVE" : context.currentBid > valuation.fairValue ? "CONCERNED" : context.currentBid > 0 ? "COMPETING" : shouldBid ? "INTERESTED" : "CALM";
  return { shouldBid, bid, maxBid, valuation, psychology, confidence: Math.max(0, Math.min(100, Math.round(valuation.confidence + (shouldBid ? 5 : -5)))) };
}
