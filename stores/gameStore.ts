import { create } from "zustand";
import { advanceAuction, createAuction, processPass, processUserBid, type AuctionState } from "@/engine/auctionEngine";
import { PLAYER_DATASET_VERSION } from "@/data/players/2027";
import { RULE_SET_SNAPSHOT } from "@/data/rules";
import type { GameSetup } from "@/domain/onboarding";
import { resolveAuctionSession, type AuctionSessionConfig } from "@/engine/setup/sessionConfig";
import { auctionSaveKey, createAuctionSaveRepository, type AuctionSaveRepository } from "@/infrastructure/persistence/auctionSaveRepository";
import { audioEngine } from "@/lib/audioEngine";

type GameStore = {
  auction: AuctionState | null;
  currentRoute: "/auction" | "/auction/report" | null;
  hydrationStatus: "idle" | "loading" | "ready";
  activeSaveKey: string | null;
  hydrate: (franchiseId: string, setup?: Partial<GameSetup> | string) => void;
  bid: (increment?: number) => void;
  pass: () => void;
  advance: () => void;
  reset: (franchiseId: string, setup?: Partial<GameSetup> | string) => void;
  toggleSound: () => void;
  setMaxBid: (amount: number | null) => void;
  toggleSmartMax: () => void;
};

let repository: AuctionSaveRepository | null = null;
let saveTimer: number | null = null;

function browserRepository(): AuctionSaveRepository | null {
  if (typeof window === "undefined") return null;
  repository ??= createAuctionSaveRepository();
  return repository;
}

function saveVersions(auction: AuctionState) {
  return {
    rulesVersion: auction.rulesVersion,
    datasetVersion: auction.dataVersion,
    simulationModelVersion: auction.simulationModelVersion
  };
}

function sessionFrom(setup?: Partial<GameSetup> | string): AuctionSessionConfig {
  return resolveAuctionSession(typeof setup === "string" ? { seed: setup } : setup);
}

function sessionSaveKey(franchiseId: string, session: AuctionSessionConfig): string {
  const { format, difficulty, seed } = session.setup;
  // Keep the original key for the default profile so existing saves resume.
  if (format === "AUTHENTIC" && difficulty === "STRATEGIST") return auctionSaveKey(franchiseId, seed);
  return auctionSaveKey(franchiseId, `${seed}::${format}::${difficulty}`);
}

function createSessionAuction(franchiseId: string, session: AuctionSessionConfig): AuctionState {
  return createAuction(franchiseId, session.setup.seed, session.rules, session.players, session.setup.difficulty, {
    format: session.setup.format,
    graphicsQuality: session.setup.graphicsQuality,
    poolLabel: session.poolLabel
  });
}

function normalizeLoadedAuction(auction: AuctionState, session: AuctionSessionConfig): AuctionState {
  return {
    ...auction,
    auctionCategory: (auction.auctionCategory ?? auction.category) as AuctionState["auctionCategory"],
    userMaxBid: auction.userMaxBid ?? null,
    smartMaxEnabled: auction.smartMaxEnabled ?? false,
    tension: auction.tension ?? 18,
    aiTrace: auction.aiTrace ?? null,
    rulesVersion: auction.rulesVersion ?? RULE_SET_SNAPSHOT.version,
    dataVersion: auction.dataVersion ?? PLAYER_DATASET_VERSION,
    simulationModelVersion: auction.simulationModelVersion ?? RULE_SET_SNAPSHOT.simulationModelVersion,
    ruleSet: auction.ruleSet ?? session.rules ?? RULE_SET_SNAPSHOT,
    playerPoolIds: auction.playerPoolIds ?? auction.order,
    difficulty: auction.difficulty ?? session.setup.difficulty,
    format: auction.format ?? session.setup.format,
    // Graphics is a live presentation preference, not an economic input. A
    // resumed save should immediately adopt the current setup tier instead of
    // silently restoring the tier from an older run.
    graphicsQuality: session.setup.graphicsQuality,
    poolLabel: auction.poolLabel ?? session.poolLabel
  };
}

export const useGameStore = create<GameStore>((set) => ({
  auction: null,
  currentRoute: null,
  hydrationStatus: "idle",
  activeSaveKey: null,
  hydrate: (franchiseId, setup) => {
    const session = sessionFrom(setup);
    const seed = session.setup.seed;
    const store = useGameStore.getState();
    const current = store.auction;
    const key = sessionSaveKey(franchiseId, session);
    if (current?.userFranchiseId === franchiseId && current.seed === seed && store.activeSaveKey === key && store.hydrationStatus !== "idle") return;
    const fresh = createSessionAuction(franchiseId, session);
    set({ auction: fresh, currentRoute: "/auction", hydrationStatus: "loading", activeSaveKey: key });

    const activeRepository = browserRepository();
    if (!activeRepository) {
      set({ hydrationStatus: "ready" });
      return;
    }
    void activeRepository.load(key).then((record) => {
      const loaded = record?.auction;
      const latest = useGameStore.getState();
      if (latest.activeSaveKey !== key) return;
      if (loaded) {
        set({ auction: normalizeLoadedAuction(loaded, session), currentRoute: loaded.completed ? "/auction/report" : "/auction", hydrationStatus: "ready" });
      } else {
        set({ hydrationStatus: "ready" });
      }
    }).catch(() => {
      // A broken browser adapter should never prevent starting a new auction.
      if (useGameStore.getState().activeSaveKey === key) set({ hydrationStatus: "ready" });
    });
  },
  bid: (increment) => set((state) => {
    if (!state.auction) return state;
    const newAuction = processUserBid(state.auction, increment);
    if (newAuction !== state.auction && state.auction.soundOn) audioEngine.playBidConfirm();
    return { auction: newAuction };
  }),
  pass: () => set((state) => {
    if (!state.auction) return state;
    const newAuction = processPass(state.auction);
    if (state.auction.soundOn) audioEngine.crowdMurmur();
    return { auction: newAuction };
  }),
  advance: () => set((state) => {
    if (!state.auction) return state;
    const auction = advanceAuction(state.auction);
    if (state.auction.soundOn) {
      if (auction.completed) audioEngine.playSoldFanfare();
      else if (auction.highestBidder && auction.highestBidder !== "YOU") audioEngine.playBidConfirm();
    }
    return { auction, currentRoute: auction.completed ? "/auction/report" : "/auction" };
  }),
  reset: (franchiseId, setup) => {
    const session = sessionFrom(setup);
    set({ auction: createSessionAuction(franchiseId, session), currentRoute: "/auction", hydrationStatus: "ready", activeSaveKey: sessionSaveKey(franchiseId, session) });
  },
  toggleSound: () => set((state) => state.auction ? { auction: { ...state.auction, soundOn: !state.auction.soundOn } } : state),
  setMaxBid: (amount) => set((state) => state.auction ? { auction: { ...state.auction, userMaxBid: amount } } : state),
  toggleSmartMax: () => set((state) => state.auction ? { auction: { ...state.auction, smartMaxEnabled: !state.auction.smartMaxEnabled } } : state)
}));

useGameStore.subscribe((state) => {
  if (typeof window === "undefined" || !state.auction || state.hydrationStatus !== "ready") return;
  if (saveTimer) window.clearTimeout(saveTimer);
  const snapshot = state.auction;
  saveTimer = window.setTimeout(() => {
    const activeRepository = browserRepository();
    if (!activeRepository) return;
    const key = state.activeSaveKey ?? auctionSaveKey(snapshot.userFranchiseId, snapshot.seed);
    void activeRepository.save(key, snapshot, saveVersions(snapshot)).catch(() => {
      // The repository already attempts its compatibility fallback. Persistence remains best effort.
    });
  }, 80);
});
