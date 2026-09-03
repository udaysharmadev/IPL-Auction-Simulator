/**
 * Deterministic pseudo-random streams used by the simulation.
 *
 * Every named stream is derived directly from the root seed. This is
 * deliberate: consuming values from one stream can never shift another
 * stream, which keeps replays stable when presentation code changes.
 */
export type SeededRng = {
  readonly seed: string;
  readonly stream: string;
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T | undefined;
  fork: (name: string) => SeededRng;
};

const UINT32_MAX = 0xffffffff;

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

/** Creates an isolated deterministic stream for a seed/name pair. */
export function createSeededRng(seed: string, stream = "root"): SeededRng {
  // Mulberry32 has a tiny state and stable behavior across JS runtimes.
  let state = hash(`${seed}\u0000${stream}`) || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / (UINT32_MAX + 1);
  };

  return {
    seed,
    stream,
    next,
    int: (min, max) => {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError("Seeded RNG integer bounds are invalid");
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    pick: <T>(items: readonly T[]) => items.length ? items[Math.floor(next() * items.length)] : undefined,
    fork: (name) => createSeededRng(seed, `${stream}/${name}`)
  };
}

/**
 * Returns the standard simulation streams. Callers should use the named
 * stream they own instead of sharing a mutable root RNG.
 */
export function createNamedRng(seed: string, stream: string, scope?: string): SeededRng {
  return createSeededRng(seed, scope ? `${stream}/${scope}` : stream);
}

export function createRngStreams(seed: string) {
  return {
    auctionOrder: createNamedRng(seed, "auction-order"),
    aiDecisions: createNamedRng(seed, "ai-decisions"),
    marketVariance: createNamedRng(seed, "market-variance"),
    auctionEvents: createNamedRng(seed, "auction-events"),
    seasonSimulation: createNamedRng(seed, "season-simulation")
  };
}

