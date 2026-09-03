import type { Difficulty } from "@/domain/onboarding";

/**
 * Difficulty changes how accurately rivals read the market. It never grants
 * extra purse or bypasses squad rules, so every level plays the same legal
 * auction with a different quality of decision-making.
 */
export type AiDifficultyProfile = {
  id: Difficulty;
  valuationNoise: number;
  marketAwareness: number;
  needAwareness: number;
  initiativeNoise: number;
};

export const AI_DIFFICULTY_PROFILES: Readonly<Record<Difficulty, AiDifficultyProfile>> = Object.freeze({
  ROOKIE: profile("ROOKIE", 1.8, 0.55, 0.7, 1.55),
  STRATEGIST: profile("STRATEGIST", 1, 1, 1, 1),
  EXPERT: profile("EXPERT", 0.62, 1.12, 1.1, 0.68),
  GM: profile("GM", 0.35, 1.25, 1.18, 0.42)
});

export function aiDifficultyProfile(difficulty: Difficulty | undefined): AiDifficultyProfile {
  return AI_DIFFICULTY_PROFILES[difficulty ?? "STRATEGIST"];
}

function profile(
  id: Difficulty,
  valuationNoise: number,
  marketAwareness: number,
  needAwareness: number,
  initiativeNoise: number
): AiDifficultyProfile {
  return { id, valuationNoise, marketAwareness, needAwareness, initiativeNoise };
}
