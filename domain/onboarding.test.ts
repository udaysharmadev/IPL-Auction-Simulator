import { describe, expect, it } from "vitest";
import { canEnter, checkpointFromProgress, parseCheckpoint, redirectFor, requiredPath, routeKey, serializeCheckpoint, type OnboardingProgress } from "./onboarding";

const progress = (overrides: Partial<OnboardingProgress> = {}): OnboardingProgress => ({
  rulesAccepted: false,
  setup: null,
  franchiseId: null,
  introSeen: false,
  readyForAuction: false,
  auctionComplete: false,
  ...overrides
});

describe("onboarding progression", () => {
  it("always starts at the rules", () => expect(requiredPath(progress())).toBe("/rules"));
  it("requires setup before franchise selection", () => expect(requiredPath(progress({ rulesAccepted: true }))).toBe("/setup"));
  it("requires the war room before auction entry", () => expect(requiredPath(progress({ rulesAccepted: true, setup: { format: "AUTHENTIC", difficulty: "STRATEGIST", graphicsQuality: "HIGH", seed: "TEST", rulesVersion: "2027-PROJECTED-v1" }, franchiseId: "KKR", introSeen: true }))).toBe("/war-room"));
  it("uses the selected franchise in the cinematic route", () => expect(requiredPath(progress({ rulesAccepted: true, setup: { format: "AUTHENTIC", difficulty: "STRATEGIST", graphicsQuality: "HIGH", seed: "TEST", rulesVersion: "2027-PROJECTED-v1" }, franchiseId: "KKR" }))).toBe("/franchise/KKR/intro"));
  it("allows review routes but blocks future checkpoints", () => {
    const configured = progress({ rulesAccepted: true, setup: { format: "AUTHENTIC", difficulty: "STRATEGIST", graphicsQuality: "HIGH", seed: "TEST", rulesVersion: "2027-PROJECTED-v1" } });
    expect(canEnter("/rules", configured)).toBe(true);
    expect(canEnter("/franchise", configured)).toBe(true);
    expect(canEnter("/war-room", configured)).toBe(false);
    expect(canEnter("/setup", configured)).toBe(true);
  });
  it("allows a completed checkpoint to be revisited without opening future routes", () => {
    const ready = progress({ rulesAccepted: true, setup: { format: "AUTHENTIC", difficulty: "STRATEGIST", graphicsQuality: "HIGH", seed: "TEST", rulesVersion: "2027-PROJECTED-v1" }, franchiseId: "KKR", introSeen: true, readyForAuction: true });
    expect(canEnter("/war-room", ready)).toBe(true);
    expect(canEnter("/auction", ready)).toBe(true);
    expect(canEnter("/auction/report", ready)).toBe(false);
    expect(redirectFor("/auction/report", ready)).toBe("/auction");
  });
  it("routes a completed auction to its report and normalizes report URLs", () => {
    const completed = progress({ rulesAccepted: true, setup: { format: "AUTHENTIC", difficulty: "STRATEGIST", graphicsQuality: "HIGH", seed: "TEST", rulesVersion: "2027-PROJECTED-v1" }, franchiseId: "KKR", introSeen: true, readyForAuction: true, auctionComplete: true });
    expect(requiredPath(completed)).toBe("/auction/report");
    expect(canEnter("/auction/report", completed)).toBe(true);
    expect(redirectFor("/auction/report?view=summary", completed)).toBeNull();
    expect(routeKey("/auction/report/")).toBe("/auction/report");
  });
  it("rejects a cinematic URL for a franchise other than the selected team", () => {
    const selected = progress({ rulesAccepted: true, setup: { format: "AUTHENTIC", difficulty: "STRATEGIST", graphicsQuality: "HIGH", seed: "TEST", rulesVersion: "2027-PROJECTED-v1" }, franchiseId: "KKR" });
    expect(canEnter("/franchise/MI/intro", selected)).toBe(false);
    expect(redirectFor("/franchise/MI/intro", selected)).toBe("/franchise/KKR/intro");
  });
  it("round-trips a versioned checkpoint without leaking setup details", () => {
    const checkpoint = checkpointFromProgress(progress({ rulesAccepted: true, setup: { format: "CUSTOM", difficulty: "GM", graphicsQuality: "ULTRA", seed: "SECRET", rulesVersion: "2027" }, franchiseId: "MI", introSeen: true, readyForAuction: true, auctionComplete: true }));
    const parsed = parseCheckpoint(serializeCheckpoint(checkpoint));
    expect(parsed).toEqual({ ...checkpoint, version: 1 });
    expect(serializeCheckpoint(checkpoint)).not.toContain("SECRET");
  });
});
