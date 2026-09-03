/**
 * Pure onboarding state machine shared by browser screens and Next middleware.
 * It intentionally has no React, Zustand, DOM, or Node-only dependencies.
 */

export type Difficulty = "ROOKIE" | "STRATEGIST" | "EXPERT" | "GM";
export type GraphicsQuality = "ULTRA" | "HIGH" | "BALANCED" | "PERFORMANCE";
export type AuctionFormat = "AUTHENTIC" | "QUICK" | "CUSTOM";

export type GameSetup = {
  format: AuctionFormat;
  difficulty: Difficulty;
  graphicsQuality: GraphicsQuality;
  seed: string;
  rulesVersion: string;
};

export type AuctionTarget = {
  playerId: string;
  priority: "A" | "B" | "C";
  maxBid: number;
};

export type OnboardingProgress = {
  rulesAccepted: boolean;
  setup: GameSetup | null;
  franchiseId: string | null;
  introSeen: boolean;
  readyForAuction: boolean;
  /** True once the auction engine reaches a terminal result. Optional for v1 save compatibility. */
  auctionComplete?: boolean;
};

/** Only this small, non-sensitive projection is mirrored to a cookie. */
export type OnboardingCheckpoint = {
  version: 1;
  rulesAccepted: boolean;
  setupComplete: boolean;
  franchiseId: string | null;
  introSeen: boolean;
  readyForAuction: boolean;
  auctionComplete: boolean;
};

export const ONBOARDING_CHECKPOINT_COOKIE = "ipl-onboarding-checkpoint";
export const ONBOARDING_CHECKPOINT_VERSION = 1 as const;

export type OnboardingRoute =
  | "/rules"
  | "/setup"
  | "/franchise"
  | "/franchise/intro"
  | "/war-room"
  | "/auction"
  | "/auction/report";

export function checkpointFromProgress(progress: Pick<OnboardingProgress, "rulesAccepted" | "setup" | "franchiseId" | "introSeen" | "readyForAuction" | "auctionComplete">): OnboardingCheckpoint {
  return {
    version: ONBOARDING_CHECKPOINT_VERSION,
    rulesAccepted: progress.rulesAccepted,
    setupComplete: Boolean(progress.setup),
    franchiseId: progress.franchiseId,
    introSeen: progress.introSeen,
    readyForAuction: progress.readyForAuction,
    auctionComplete: Boolean(progress.auctionComplete)
  };
}

export function progressFromCheckpoint(checkpoint: OnboardingCheckpoint): OnboardingProgress {
  return {
    rulesAccepted: checkpoint.rulesAccepted,
    // The cookie deliberately omits setup details. Middleware only needs the
    // completion bit, so use a typed placeholder when adapting to the domain.
    setup: checkpoint.setupComplete ? {
      format: "AUTHENTIC",
      difficulty: "STRATEGIST",
      graphicsQuality: "HIGH",
      seed: "checkpoint",
      rulesVersion: "checkpoint"
    } : null,
    franchiseId: checkpoint.franchiseId,
    introSeen: checkpoint.introSeen,
    readyForAuction: checkpoint.readyForAuction,
    auctionComplete: checkpoint.auctionComplete
  };
}

/** Encode with URI escaping so this value is safe in a Set-Cookie header. */
export function serializeCheckpoint(checkpoint: OnboardingCheckpoint): string {
  return encodeURIComponent(JSON.stringify(checkpoint));
}

export function parseCheckpoint(value: string | null | undefined): OnboardingCheckpoint | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (!isCheckpoint(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isCheckpoint(value: unknown): value is OnboardingCheckpoint {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OnboardingCheckpoint>;
  return candidate.version === ONBOARDING_CHECKPOINT_VERSION
    && typeof candidate.rulesAccepted === "boolean"
    && typeof candidate.setupComplete === "boolean"
    && (typeof candidate.franchiseId === "string" || candidate.franchiseId === null)
    && typeof candidate.introSeen === "boolean"
    && typeof candidate.readyForAuction === "boolean"
    && typeof candidate.auctionComplete === "boolean";
}

/** Return the first route the user must complete/resume. */
export function requiredPath(progress: OnboardingProgress): string {
  if (!progress.rulesAccepted) return "/rules";
  if (!progress.setup) return "/setup";
  if (!progress.franchiseId) return "/franchise";
  if (!progress.introSeen) return `/franchise/${encodeURIComponent(progress.franchiseId)}/intro`;
  if (!progress.readyForAuction) return "/war-room";
  if (progress.auctionComplete === true) return "/auction/report";
  return "/auction";
}

/** Convert concrete dynamic routes into stable route-machine keys. */
export function routeKey(pathname: string): OnboardingRoute | null {
  const path = normalizePath(pathname);
  if (path === "/rules" || path === "/setup" || path === "/franchise" || path === "/war-room" || path === "/auction" || path === "/auction/report") return path;
  if (/^\/franchise\/[^/]+\/intro$/.test(path)) return "/franchise/intro";
  return null;
}

function normalizePath(pathname: string): string {
  const path = pathname.split("?")[0]?.split("#")[0] ?? "/";
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function requestedFranchiseId(pathname: string): string | null {
  const match = normalizePath(pathname).match(/^\/franchise\/([^/]+)\/intro$/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/** Backward/review routes are allowed; only future checkpoints are blocked. */
export function canEnter(pathname: string, progress: OnboardingProgress): boolean {
  const requested = routeKey(pathname);
  if (!requested) return false;
  const required = routeKey(requiredPath(progress)) ?? "/rules";
  if (requested === "/franchise/intro") {
    const requestedId = requestedFranchiseId(pathname);
    if (requestedId && progress.franchiseId && requestedId !== progress.franchiseId) return false;
  }
  // A route is reviewable only when its checkpoint has actually been
  // completed. The exception is the current required route itself.
  if (requested === required) return true;
  if (requested === "/rules") return true;
  if (requested === "/setup") return progress.rulesAccepted;
  if (requested === "/franchise") return Boolean(progress.rulesAccepted && progress.setup);
  if (requested === "/franchise/intro") return Boolean(progress.rulesAccepted && progress.setup && progress.franchiseId);
  if (requested === "/war-room") return Boolean(progress.rulesAccepted && progress.setup && progress.franchiseId && progress.introSeen);
  if (requested === "/auction") return Boolean(progress.rulesAccepted && progress.setup && progress.franchiseId && progress.introSeen && progress.readyForAuction);
  if (requested === "/auction/report") return Boolean(progress.rulesAccepted && progress.setup && progress.franchiseId && progress.introSeen && progress.readyForAuction && progress.auctionComplete === true);
  return false;
}

/** Return a redirect target for middleware/client gates, or null when allowed. */
export function redirectFor(pathname: string, progress: OnboardingProgress): string | null {
  return canEnter(pathname, progress) ? null : requiredPath(progress);
}
