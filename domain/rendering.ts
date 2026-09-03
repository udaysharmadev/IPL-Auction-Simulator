import type { GraphicsQuality } from "@/domain/onboarding";

/** Runtime rendering budget. This is intentionally data-only so a future
 * WebGL/React-Three renderer can consume the same quality contract. */
export type RenderQualityProfile = {
  quality: GraphicsQuality;
  particleCount: number;
  maxDevicePixelRatio: number;
  enableSaleBurst: boolean;
  enablePulse: boolean;
  shadowOpacity: number;
};

export const RENDER_QUALITY_PROFILES: Record<GraphicsQuality, RenderQualityProfile> = {
  ULTRA: { quality: "ULTRA", particleCount: 96, maxDevicePixelRatio: 2, enableSaleBurst: true, enablePulse: true, shadowOpacity: 0.22 },
  HIGH: { quality: "HIGH", particleCount: 64, maxDevicePixelRatio: 1.75, enableSaleBurst: true, enablePulse: true, shadowOpacity: 0.16 },
  BALANCED: { quality: "BALANCED", particleCount: 42, maxDevicePixelRatio: 1.35, enableSaleBurst: true, enablePulse: false, shadowOpacity: 0.11 },
  PERFORMANCE: { quality: "PERFORMANCE", particleCount: 20, maxDevicePixelRatio: 1, enableSaleBurst: false, enablePulse: false, shadowOpacity: 0.07 }
};

export function renderQualityProfile(quality: GraphicsQuality | null | undefined): RenderQualityProfile {
  return RENDER_QUALITY_PROFILES[quality ?? "HIGH"];
}

