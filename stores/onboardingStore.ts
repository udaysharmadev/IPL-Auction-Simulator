import { create } from "zustand";
import { persist } from "zustand/middleware";
import { RULE_SET } from "@/data/rules";
import { checkpointFromProgress, ONBOARDING_CHECKPOINT_COOKIE, requiredPath, serializeCheckpoint, type Difficulty, type GameSetup, type GraphicsQuality, type OnboardingProgress, type AuctionFormat, type AuctionTarget } from "@/domain/onboarding";
import { resolveAuctionSession } from "@/engine/setup/sessionConfig";

type OnboardingStore = OnboardingProgress & {
  targets: AuctionTarget[];
  currentPath: () => string;
  acceptRules: () => void;
  updateSetup: (setup: Partial<GameSetup>) => void;
  selectFranchise: (franchiseId: string) => void;
  completeIntro: () => void;
  setTargets: (targets: AuctionTarget[]) => void;
  markReady: () => void;
  markAuctionComplete: () => void;
  rewindTo: (stage: "RULES" | "SETUP" | "FRANCHISE" | "INTRO") => void;
  resetOnboarding: () => void;
};

const initialState = (): OnboardingProgress & { targets: AuctionTarget[] } => ({ rulesAccepted: false, setup: null, franchiseId: null, introSeen: false, readyForAuction: false, auctionComplete: false, targets: [] });

export const useOnboardingStore = create<OnboardingStore>()(persist((set, get) => ({
  ...initialState(),
  currentPath: () => requiredPath(get()),
  acceptRules: () => set({ rulesAccepted: true }),
  updateSetup: (partial) => set((state) => {
    const previous = state.setup;
    const candidate: Partial<GameSetup> = {
      format: "AUTHENTIC",
      difficulty: "STRATEGIST",
      graphicsQuality: "HIGH",
      seed: `2027-AUCTION-${Math.floor(100000 + Math.random() * 899999)}`,
      rulesVersion: RULE_SET.version,
      ...(previous ?? {}),
      ...partial
    };
    // Zustand persistence is an untrusted boundary. Resolve here as well as
    // in the engine so setup screens always render a concrete, valid profile.
    const setup: GameSetup = resolveAuctionSession(candidate).setup;
    const gameplayChanged = Boolean(previous && (previous.format !== setup.format || previous.difficulty !== setup.difficulty || previous.seed !== setup.seed || previous.rulesVersion !== setup.rulesVersion));
    return gameplayChanged
      ? { setup, franchiseId: null, introSeen: false, readyForAuction: false, auctionComplete: false, targets: [] }
      : { setup };
  }),
  selectFranchise: (franchiseId) => set({ franchiseId, introSeen: false, readyForAuction: false, auctionComplete: false }),
  completeIntro: () => set({ introSeen: true }),
  setTargets: (targets) => set({ targets }),
  markReady: () => set({ readyForAuction: true, auctionComplete: false }),
  markAuctionComplete: () => set({ auctionComplete: true }),
  rewindTo: (stage) => set((state) => stage === "RULES" ? { rulesAccepted: false, setup: null, franchiseId: null, introSeen: false, readyForAuction: false, auctionComplete: false, targets: [] } : stage === "SETUP" ? { setup: null, franchiseId: null, introSeen: false, readyForAuction: false, auctionComplete: false, targets: [] } : stage === "FRANCHISE" ? { franchiseId: null, introSeen: false, readyForAuction: false, auctionComplete: false, targets: [] } : { introSeen: false, readyForAuction: false, auctionComplete: false }),
  resetOnboarding: () => set(initialState())
}), {
  name: "ipl-2027-phase-one",
  version: 2,
  migrate: (persisted) => ({ ...initialState(), ...(persisted as Partial<OnboardingStore>), auctionComplete: Boolean((persisted as Partial<OnboardingStore>)?.auctionComplete) }),
  partialize: (state) => ({ rulesAccepted: state.rulesAccepted, setup: state.setup, franchiseId: state.franchiseId, introSeen: state.introSeen, readyForAuction: state.readyForAuction, auctionComplete: state.auctionComplete, targets: state.targets })
}));

export const setupDefaults: GameSetup = { format: "AUTHENTIC" as AuctionFormat, difficulty: "STRATEGIST" as Difficulty, graphicsQuality: "HIGH" as GraphicsQuality, seed: "2027-AUCTION-847293", rulesVersion: RULE_SET.version };

export function bootstrapOnboarding() {
  mirrorOnboardingCheckpoint(useOnboardingStore.getState());
}

export function mirrorOnboardingCheckpoint(state: Pick<OnboardingProgress, "rulesAccepted" | "setup" | "franchiseId" | "introSeen" | "readyForAuction" | "auctionComplete">): void {
  if (typeof document === "undefined") return;
  const value = serializeCheckpoint(checkpointFromProgress(state));
  document.cookie = `${ONBOARDING_CHECKPOINT_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

useOnboardingStore.subscribe((state) => mirrorOnboardingCheckpoint(state));
