import { describe, expect, it } from "vitest";
import { createNamedRng, createRngStreams } from "./seededRng";

describe("named deterministic RNG streams", () => {
  it("replays each named stream independently", () => {
    const first = createRngStreams("season-seed");
    const second = createRngStreams("season-seed");
    expect([first.auctionOrder.next(), first.auctionOrder.next()]).toEqual([second.auctionOrder.next(), second.auctionOrder.next()]);
    expect(first.aiDecisions.next()).toBe(second.aiDecisions.next());
  });

  it("isolates stream consumption", () => {
    const baseline = createRngStreams("isolation");
    const consumed = createRngStreams("isolation");
    consumed.auctionOrder.next();
    consumed.auctionOrder.next();
    expect(consumed.aiDecisions.next()).toBe(baseline.aiDecisions.next());
    expect(createNamedRng("isolation", "market-variance").next()).toBe(createNamedRng("isolation", "market-variance").next());
  });
});

