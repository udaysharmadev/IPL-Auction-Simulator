import { describe, expect, it } from "vitest";
import { renderQualityProfile } from "./rendering";

describe("render quality profiles", () => {
  it("provides monotonic visual budgets", () => {
    expect(renderQualityProfile("ULTRA").particleCount).toBeGreaterThan(renderQualityProfile("HIGH").particleCount);
    expect(renderQualityProfile("HIGH").particleCount).toBeGreaterThan(renderQualityProfile("BALANCED").particleCount);
    expect(renderQualityProfile("BALANCED").particleCount).toBeGreaterThan(renderQualityProfile("PERFORMANCE").particleCount);
  });

  it("falls back safely for legacy saves", () => {
    expect(renderQualityProfile(undefined).quality).toBe("HIGH");
  });

  it("disables expensive effects on the performance tier", () => {
    const profile = renderQualityProfile("PERFORMANCE");
    expect(profile.enableSaleBurst).toBe(false);
    expect(profile.enablePulse).toBe(false);
    expect(profile.maxDevicePixelRatio).toBe(1);
  });
});

