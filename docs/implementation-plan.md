# IPL Auction Simulator 2027 — Elite Implementation Plan

> Based on thorough analysis of the existing codebase, the AI-generated reference screenshot, and the existing advanced plan in `docs/`. This is a ground-up rethink of what **actually** needs to be built — focused, no bloat, outstanding quality.

---

## Current State Audit

| Layer | What exists | Quality |
|---|---|---|
| **Onboarding flow** | Rules → Setup → Franchise → Intro → War Room (all in one `page.tsx`) | ✅ Good concept, 🔴 single-file monolith |
| **Auction engine** | `auctionEngine.ts` — deterministic, seeded, AI bidding | ✅ Solid core logic |
| **AI** | Single-pass value/need model, psychology states | ⚠️ Shallow — no alternatives graph, no memory |
| **Presentation** | `auctionPresentation.ts` — scarcity, warnings, camera shots, moments | ✅ Good signals |
| **3D Canvas** | `AuctionRoomCanvas.tsx` — Canvas 2D particle/light renderer | ⚠️ 2D only — no desks, no crowd, no player card |
| **Data** | 18 players, 10 franchises, hardcoded | 🔴 Too small, no real stats depth |
| **State** | Zustand `gameStore` + `onboardingStore` with localStorage | ✅ Fine for now |
| **Routing** | Single page with conditional rendering | 🔴 Needs real Next.js routes |
| **CSS** | `globals.css` + `phase-one.css` + `phase-two.css` | ⚠️ Works but monolithic |
| **Tests** | 2 test files, minimal coverage | 🔴 Needs expansion |

### What the reference image shows (target)
- **Left panel**: Franchise badge, purse meter, squad list with prices, squad needs
- **Center**: Full 3D auction room with 10 franchise desks arranged in a semicircle, auctioneer podium, crowd, IPL branding, player card on stage screen
- **Player card**: Avatar portrait, name, role, base price, stats (matches/wickets/economy/best/age)
- **Highest bid banner**: Current price + leading franchise logo
- **Bottom bid console**: Current bid, +0.25/+0.50/+1 CR/+2 CR/CUSTOM BID buttons, BID (green) and PASS (red)
- **Right panel**: "ALL PLAYERS" table with role filter tabs (ALL/BAT/BOWL/AR/WK), player name, type, base price
- **Top bar**: Day, Round X/20, Players Left, Timer countdown, Leave Auction button

---

## Game Flow (locked — no deviation)

```
BOOT SCREEN  ──────────────────────────────────────────────────────────────────
  ↓ (auto-redirect if save exists → resume)
RULES & REGULATIONS  (5 cinematic rule cards, must acknowledge)
  ↓
AUCTION SETUP  (format / difficulty / seed — shown as a side-by-side choice panel)
  ↓
FRANCHISE SELECTION HALL  (10 teams, cinematic reveal, compare mode)
  ↓
FRANCHISE CINEMATIC INTRO  (6s skippable, team color + lore)
  ↓
WAR ROOM  (retained squad, squad gaps, target board, max bids, scarcity forecast)
  ↓
LIVE AUCTION ROOM  (THE core experience — described below)
  ↓
POST-AUCTION REPORT  (squad grade, moments, counterfactuals, replay)
```

**No coins. No gems. No shop. No XP. No leaderboard.**

---

## Milestone 1 — Architecture Refactor + Data Foundation
**Goal**: Clean up the monolith, establish real routing, expand the player pool, and split the engine properly. Everything else builds on this.

---

### 1.1 Real Next.js App Router Routes

**Problem**: All screens live in one 1,600-line `page.tsx`. Every new feature makes this worse.

**What to build**:

```
app/
  page.tsx                     ← Boot screen (redirect logic only)
  rules/page.tsx               ← Rules & Regulations
  setup/page.tsx               ← Auction configuration
  franchise/page.tsx           ← Franchise selection hall
  franchise/[id]/intro/page.tsx← Team cinematic
  war-room/page.tsx            ← Pre-auction planning
  auction/page.tsx             ← LIVE AUCTION (main event)
  auction/report/page.tsx      ← Post-auction report
  layout.tsx                   ← Root layout (font, meta, global CSS)
```

**Navigation guard** — a `middleware.ts` state machine:
```
BOOT → RULES_REQUIRED → SETUP_REQUIRED → FRANCHISE_REQUIRED →
WAR_ROOM_READY → AUCTION_READY → AUCTION_COMPLETE
```
Any direct URL access that skips a required step redirects to the earliest incomplete checkpoint.

#### [MODIFY] [`app/page.tsx`](file:///Users/uday/IPL%20Auction%20Simulator/app/page.tsx)
- Strip all screen components out into their own route files
- Keep only boot-screen redirect logic

#### [NEW] `app/rules/page.tsx`, `app/setup/page.tsx`, `app/franchise/page.tsx`, `app/franchise/[id]/intro/page.tsx`, `app/war-room/page.tsx`, `app/auction/page.tsx`, `app/auction/report/page.tsx`
- Each screen is a standalone React Server Component shell with a `"use client"` island for interactivity

#### [NEW] `middleware.ts`
- Navigation guard using `onboardingStore` hydrated from cookies/localStorage

---

### 1.2 Player & Data Expansion

**Problem**: 18 players is too small to create meaningful scarcity, bid wars, or squad building decisions. The image shows 156 players remaining.

**What to build**:

#### [MODIFY] [`data/mockData.ts`](file:///Users/uday/IPL%20Auction%20Simulator/data/mockData.ts)
Expand to **120+ players** covering:
- 10 marquee Indian batters
- 12 marquee Indian bowlers  
- 8 Indian all-rounders
- 4 Indian wicketkeepers
- 10 elite overseas batters (Buttler, Conway, Klaasen, etc.)
- 10 elite overseas bowlers (Starc, Bumrah era peers, Nortje, etc.)
- 8 overseas all-rounders
- 4 overseas wicketkeepers
- ~55 Indian domestic/uncapped players across all roles

Each player gets:
```ts
type Player = {
  playerId: string;
  identity: { name: string; shortName: string; nationality: string; age: number; imageSlug: string };
  role: { primary: Role; battingStyle: string; bowlingStyle?: string; specialization?: string };
  realData: {
    iplMatches: number; runs: number; wickets: number;
    battingAverage?: number; strikeRate?: number;
    bowlingAverage?: number; economy?: number; bestBowling?: string;
    catches?: number;
  };
  auctionData: {
    basePrice: number;
    cappedStatus: "CAPPED" | "UNCAPPED";
    nationalityStatus: "INDIAN" | "OVERSEAS";
    category: "MARQUEE" | "CAPPED_INDIAN" | "CAPPED_OVERSEAS" | "UNCAPPED" | "ACCELERATED";
    rtmEligible: boolean;
  };
  simulationData: {
    overall: number; potential: number; consistency: number;
    pressure: number; injuryRisk: number; formTrend: "RISING" | "STABLE" | "DECLINING";
  };
  valuation: { fairValue: number; confidence: number; scarcity: string; reason: string };
};
```

#### [NEW] `data/players/2027.ts` (split from mockData)
#### [NEW] `data/teams/franchises.ts` (split from mockData)
#### [NEW] `data/auction/categoryOrder.ts`
- Defines the order: Marquee set → Capped Indians → Capped Overseas → Uncapped → Accelerated round

---

### 1.3 Engine Decomposition

**Problem**: `auctionEngine.ts` is 89 dense lines doing everything. AI, bid logic, squad rules, and presentation are all entangled.

**What to build**:

#### [MODIFY] [`engine/auctionEngine.ts`](file:///Users/uday/IPL%20Auction%20Simulator/engine/auctionEngine.ts)
- Keep `AuctionState`, `AuctionPhase`, `AuctionEvent` types
- Remove AI logic → move to `engine/ai/`
- Remove presentation signals → keep in `engine/auctionPresentation.ts`
- Add `round` tracking per auction category (Marquee Round 1, etc.)

#### [NEW] `engine/ai/aiBidder.ts`
Pure function: `(state: AuctionState, franchiseId: string, rng: SeededRng) → AiBidDecision`

#### [NEW] `engine/ai/aiValuation.ts`
Context-aware fair value per franchise (considers their existing squad, budget, remaining categories)

#### [NEW] `engine/squad/squadRules.ts`
All squad validation: max size, overseas cap, minimum squad threshold

#### [NEW] `engine/random/seededRng.ts`
Named RNG streams so AI decisions never bleed into camera/UI randomness

#### [NEW] `engine/auction/orderGenerator.ts`
Generates player order respecting category groups (marquee first, then accelerated round last)

---

### 1.4 Store Cleanup

#### [MODIFY] [`stores/gameStore.ts`](file:///Users/uday/IPL%20Auction%20Simulator/stores/gameStore.ts)
- Add `saveToIndexedDB` (replace localStorage for saves — too small for 120 players)
- Add `currentRoute` derived state for navigation guard

#### [MODIFY] [`stores/onboardingStore.ts`](file:///Users/uday/IPL%20Auction%20Simulator/stores/onboardingStore.ts)
- Add `auctionCategory` — tracks which category is currently being auctioned
- Persist to cookie for SSR navigation guard

---

### Milestone 1 Quality Gate
- `typecheck` and `lint` pass with zero errors
- Same seed + same decisions produce identical auction outcomes
- 120+ players load without schema errors
- Navigation guard prevents direct-URL bypassing of onboarding
- All existing test files pass

---

## Milestone 2 — Outstanding Auction Room UI

**Goal**: The center-stage 3D auction room that matches the reference image — franchise desks, player card, live bid ticker, camera shots. This is the game's signature moment.

---

### 2.1 Auction Room Layout (matching reference image exactly)

The layout has **4 zones**:

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOPBAR: Day | Round X/20 | Players Left | Timer | Leave Auction     │
├────────────┬─────────────────────────────────────┬───────────────────┤
│            │                                     │                   │
│  LEFT      │         CENTER: 3D AUCTION ROOM     │  RIGHT PANEL      │
│  PANEL     │  ┌──────────────────────────────┐   │  ALL PLAYERS      │
│            │  │  PLAYER CARD (center stage)  │   │  Filter tabs      │
│ Franchise  │  │  Name / Role / Base / Stats  │   │  Player table     │
│ Badge      │  │  HIGHEST BID banner          │   │  (scrollable)     │
│ Purse      │  │  Franchise desks semicircle  │   │                   │
│ Squad list │  │  Auctioneer podium           │   │                   │
│ Needs      │  │  IPL branding                │   │                   │
│            │  └──────────────────────────────┘   │                   │
│            │  INTEL STRIP (scarcity / AI trace)  │                   │
│            │  WARNINGS                           │                   │
│            │  BID CONSOLE                        │                   │
└────────────┴─────────────────────────────────────┴───────────────────┘
```

#### [NEW] `app/auction/page.tsx`
Full auction layout component using CSS Grid:
```css
.auction-shell {
  display: grid;
  grid-template-columns: 240px 1fr 300px;
  grid-template-rows: 52px 1fr;
}
```

---

### 2.2 Topbar Redesign (matching reference)

#### [MODIFY] auction topbar
- **Left**: IPL AUCTION SIMULATOR logo + trophy icon
- **Center**: DAY 1 | ROUND 12/20 | PLAYERS LEFT 156 | 02:45 TIME LEFT (live countdown)
- **Right**: Help (?) | Sound | Settings | LEAVE AUCTION (red button)
- Round counter derives from `auction.currentIndex / playersPerRound`
- Timer is a per-player countdown (configurable: 30s default, 0 = unlimited)

---

### 2.3 Left Panel Redesign (matching reference)

#### [NEW] `components/auction/LeftPanel.tsx`
```
YOUR TEAM
[KKR badge + name]

PURSE REMAINING
₹ 28.50 CR  [progress bar]

SQUAD (9/25)  [cart icon]
  R. Sharma    ₹ 8.00 CR
  S. Gill      ₹ 7.50 CR
  ...

[VIEW SQUAD button]
```

Each squad entry shows player name + amount paid. Clicking opens the player intel drawer. Scrollable list.

---

### 2.4 Center: 3D Auction Room Scene

This is the most important milestone. The existing `AuctionRoomCanvas` is a Canvas 2D particle renderer — it needs to become a proper 3D room.

**Technology**: Keep Canvas 2D for now (no Three.js yet — add in Milestone 4). Instead, build a **CSS 3D perspective scene** that looks premium without the weight:

#### [MODIFY] [`components/auction/AuctionRoomCanvas.tsx`](file:///Users/uday/IPL%20Auction%20Simulator/components/auction/AuctionRoomCanvas.tsx)
Transform into a layered CSS + Canvas hybrid:

**Layer 1 — Background (Canvas 2D, existing)**: Atmospheric lights, particles, crowd silhouettes

**Layer 2 — CSS 3D Stage**: Uses `perspective` + `transform-style: preserve-3d` to create:
- Floor grid perspective
- Back wall with IPL 2027 branding (animated LED display)
- Ceiling light rigs

**Layer 3 — Player Card (HTML overlay, positioned center-stage)**:
```
┌─────────────────────────────┐
│ CURRENT PLAYER              │
│  [avatar portrait]          │
│  ARSHDEEP SINGH             │
│  BOWLER                     │
│  Base Price: ₹ 2.00 CR      │
├─────────────────────────────┤
│  PLAYER STATS               │
│  MATCHES  47                │
│  WICKETS  58                │
│  ECONOMY  8.12              │
│  BEST     4/29              │
│  AGE      25                │
└─────────────────────────────┘
```

**Layer 4 — Highest Bid Banner**:
```
HIGHEST BID
₹ 7.25 CR
[MI logo] MUMBAI INDIANS
```

**Layer 5 — Franchise Desks (10 HTML elements, CSS 3D arranged in semicircle)**:
Each desk shows:
- Team short name (KKR, MI, RCB, etc.) in team color
- Budget remaining (small screen on desk)
- **Active bidder highlights** with glow animation when they bid
- The user's desk is always at the bottom center (closest, largest)

#### [NEW] `components/auction/FranchiseDesk.tsx`
```tsx
type Props = {
  franchise: Franchise;
  budget: number;
  isUser: boolean;
  isLeading: boolean;
  isBidding: boolean; // animation trigger
  position: { angle: number; distance: number }; // for CSS 3D layout
}
```

#### [NEW] `components/auction/PlayerCard.tsx`
```tsx
type Props = {
  player: Player;
  phase: AuctionPhase;
  isNew: boolean; // triggers entrance animation
}
```
Entrance animation: player card slides up from bottom on `PLAYER_PRESENTATION` phase.

#### [NEW] `components/auction/HighestBidBanner.tsx`
```tsx
type Props = {
  bid: number;
  bidder: string | null; // franchise shortName or "YOU"
  franchise: Franchise | undefined;
}
```

---

### 2.5 Bid Console (matching reference exactly)

#### [MODIFY] bid console section

```
CURRENT BID                 YOUR BID
₹ 7.25 CR                  +0.25 CR | +0.50 CR | +1.00 CR | +2.00 CR | CUSTOM BID
BY MUMBAI INDIANS
                            [BID - green]    [PASS - red]
```

- **+0.25 CR / +0.50 CR / +1.00 CR / +2.00 CR**: Quick bid buttons (increment values from ruleset bid bands)
- **CUSTOM BID**: Opens an input to type an exact amount
- **BID**: Places bid at `currentBid + selectedIncrement`
- **PASS**: Pass on this player
- Show "SMART MAX: ON/OFF" toggle as a subtle text button (not a big feature)
- Disable all bid buttons when `phase !== "BIDDING" && phase !== "FIRST_BID" && phase !== "FINAL_CALL"`

**CRITICAL UX**: The PASS button must be red. The BID button must be green. These are the two primary actions of the entire game.

---

### 2.6 Right Panel — Player Table (matching reference)

#### [MODIFY] `components/auction/RightPanel.tsx` (extract from page.tsx)

```
ALL PLAYERS

[ALL] [BAT] [BOWL] [AR] [WK]

PLAYER          TYPE    BASE PRICE
A. Singh   →   BOWL    ₹ 2.00 CR   ← current player (highlighted)
J. Bumrah       BOWL    ₹ 2.00 CR
Y. Jaiswal      BAT     ₹ 2.00 CR
...

[Search Players...]
```

- Row highlights in team color when that player is `on-block` (current player being auctioned)
- Rows for already-sold players show the buyer and price instead of base price
- Clicking a row opens the player intel drawer

---

### 2.7 Bid Phase Announcements

The auction phases need dramatic announcements shown center-screen:

```
PLAYER_PRESENTATION → "ARSHDEEP SINGH IS WALKING INTO THE ROOM"
FIRST_BID           → "OPENING BID: ₹ 2.00 CR"  
BIDDING             → (live updates, no full-screen overlay)
FINAL_CALL          → "GOING ONCE... GOING TWICE..."
SOLD                → "SOLD! TO MUMBAI INDIANS FOR ₹ 7.25 CR" 
PASSED              → "UNSOLD — ARSHDEEP SINGH RETURNS TO THE POOL"
```

#### [NEW] `components/auction/PhaseAnnouncement.tsx`
Full-width animated text overlay that appears and disappears based on phase transitions. Uses CSS animations — no libraries.

---

### Milestone 2 Quality Gate
- The auction room matches the reference image in layout and structure
- All 10 franchise desks visible, correctly colored, active bidder highlighted
- Player card shows avatar, name, role, base price, 5 stats
- Highest bid banner updates live with franchise name
- BID (green) and PASS (red) buttons always visible
- Bid console matches reference exactly (+0.25/+0.50/+1/+2/CUSTOM BID/BID/PASS)
- Right panel player table with filter tabs and search
- Phase announcements appear and dismiss correctly
- No layout breaks at 1280px, 1440px, 1920px

---

## Milestone 3 — Intelligence: AI, Timers, and Auction Economy

**Goal**: Make the auction feel alive. 9 AI franchises with distinct personalities, a per-player countdown timer, real scarcity dynamics, and an auction that tells a story every round.

---

### 3.1 Per-Player Countdown Timer

The reference image shows **02:45 TIME LEFT** in the topbar. This is a per-player timer.

#### [NEW] `engine/auction/auctionTimer.ts`
```ts
type TimerConfig = {
  playerPresentationSeconds: number;  // 8s
  firstBidSeconds: number;            // 15s (if no bid → PASSED)
  biddingSeconds: number;             // 20s after each bid
  finalCallSeconds: number;           // 10s
};
```

Timer runs in the UI (React `useEffect` + `setInterval`). When it expires, it calls `advance()` from the game store. This means:
- Presentation phase auto-advances to `FIRST_BID`
- If `FIRST_BID` expires with no bids → player is PASSED
- `BIDDING` timer resets on each new bid
- `FINAL_CALL` expiry → player SOLD to highest bidder (or PASSED if none)

Timer display: large countdown number + color change (green → amber → red)

---

### 3.2 Advanced AI System

**Problem**: The existing AI only does one value check. It doesn't track alternatives, doesn't reserve budget for future roles, and all 9 teams behave identically.

#### [MODIFY] `engine/ai/aiBidder.ts`

Each franchise gets a **personality profile** stored in `data/teams/franchises.ts`:
```ts
type FranchiseAiProfile = {
  id: string;
  philosophy: AiPhilosophy;    // "STAR_SYSTEMS" | "VALUE_BUILD" | "YOUTH_FIRST" | "ROLE_CLARITY" | "AGGRESSOR"
  riskTolerance: number;        // 0–1 (how far above fair value they'll go)
  scarcityMultiplier: number;   // how much they panic when roles run out
  budgetReserveFraction: number;// what fraction to hold back for critical roles
  priorityRoles: Role[];        // which roles they weight highest
  nemesisFranchises: string[];  // teams they compete against most aggressively
};
```

**AI Decision Pipeline** (runs per player, per AI turn):
```
1. Compute contextual fair value for this player (base fair value + squad need boost + scarcity premium)
2. Check if squad can accept this player (size, overseas limit)
3. Compute alternatives: how many similar players remain in pool?
4. Check budget reserve: must keep ≥ X Cr for minimum squad completion
5. Apply personality modifier (risk tolerance, nemesis pressure)
6. Produce maxBid ceiling
7. If current bid < ceiling → BID. Else → PASS.
```

**Named RNG Streams** (critical — prevents AI from being affected by UI randomness):
```ts
// engine/random/seededRng.ts
export function createRngStreams(seed: string) {
  return {
    auctionOrder:    seededRng(seed + "-order"),
    aiDecisions:     seededRng(seed + "-ai"),
    marketVariance:  seededRng(seed + "-variance"),
    auctionEvents:   seededRng(seed + "-events"),
  };
}
```

**AI Memory**: Each AI franchise tracks `ownedRoles` across the auction so their decisions evolve as they fill their squad.

---

### 3.3 Difficulty Scaling

The existing difficulty options (ROOKIE / STRATEGIST / EXPERT / GM) must actually change AI behavior:

| Difficulty | AI behavior |
|---|---|
| ROOKIE | AI ignores scarcity, uses flat fair value, no budget reserve |
| STRATEGIST | AI uses need-based valuation, reserves 20% budget |
| EXPERT | AI models alternatives, reserves 30%, has nemesis behavior |
| GM | Full pipeline + user behavior memory (tracks what user bids on) |

---

### 3.4 Auction Category System

The reference shows **ROUND 12/20**. This implies structured auction sets.

#### [MODIFY] `engine/auction/orderGenerator.ts`

Player categories and their auction order:
```
SET 1: Marquee (top 8–10 players by fairValue) — open bidding, high drama
SET 2: Capped Indians (Role groups: Batters, Bowlers, All-rounders, Wicketkeepers)
SET 3: Capped Overseas (same role groups)
SET 4: Uncapped Indians (bulk, quick rounds)
SET 5: Accelerated Round (unsold players at base price, rapid fire)
```

The "Round X/20" in the topbar corresponds to the round within the current set.

Category label shown in the topbar area: "MARQUEE SET · ROUND 1" → "INDIAN BOWLERS · ROUND 3" etc.

---

### 3.5 Scarcity Economy

#### [MODIFY] `engine/auctionPresentation.ts`

Scarcity should drive AI bid ceiling dynamically:
- Count remaining players by role in the pool
- When `remaining_bowlers < 5` and you have 0 bowlers → scarcity multiplier kicks in
- Scarcity chips in the Intel Strip change severity as the auction progresses

**Market Inflation**: If 3+ teams are competing for the same role, all prices inflate. Track `demandPressure[role]` = count of teams actively needing this role.

---

### 3.6 AI Trace (Rival Intelligence Panel upgrade)

The current AI trace is a single text line. Upgrade it:

#### [MODIFY] right panel AI trace section
```
RIVAL INTELLIGENCE
────────────────────
MI  [COMPETING]  needs: BOWL (3 remaining)
     Model max: ₹ 8.50 CR  |  Alternatives: 4

RCB [INTERESTED]  needs: AR (2 remaining)
     Watching but budget pressure at ₹ 12 Cr left
```

Show the **top 2 most active rivals** for the current player, derived from `aiTrace` in state.

---

### Milestone 3 Quality Gate
- Per-player countdown timer visible in topbar, auto-advances phases on expiry
- 9 distinct AI franchises with different spending patterns across 100 test auctions
- Difficulty ROOKIE vs GM produces measurably different AI outcomes (verifiable via unit tests)
- Auction categories progress correctly (Marquee → Capped → Uncapped → Accelerated)
- Round counter in topbar correctly reflects current set position
- Scarcity chips update as players are sold
- No budget ever goes negative
- No franchise owns a player twice

---

## Milestone 4 — Visual Excellence: 3D Room + Cinematic Feel

**Goal**: Elevate the visual experience to the "outstanding level" referenced in the task. This is where Three.js / React Three Fiber comes in — the actual 3D room from the reference image.

---

### 4.1 Three.js Auction Room

#### Install dependencies:
```
@react-three/fiber @react-three/drei three @types/three
```

#### [MODIFY] [`components/auction/AuctionRoomCanvas.tsx`](file:///Users/uday/IPL%20Auction%20Simulator/components/auction/AuctionRoomCanvas.tsx)
Replace the Canvas 2D renderer with a React Three Fiber scene.

**Scene hierarchy**:
```
<Canvas shadows camera={{ position: [0, 8, 18], fov: 52 }}>
  <AuctionEnvironment />         ← Room geometry (floor, walls, ceiling)
  <StageAndPodium />             ← Center stage, auctioneer position
  <PlayerDisplayScreen />        ← Center LED screen showing player card
  <FranchiseDeskRing />          ← 10 desks in semicircle
  <CrowdSectors />               ← Instanced crowd silhouettes
  <LightingRig />                ← Spotlights, ambient, desk lamps
  <AtmosphericEffects />         ← Particles, heat shimmer, light shafts
  <CameraDirector />             ← Controls camera per auction phase
</Canvas>
```

**Art direction** (matches reference):
- Dark teal/navy floor with subtle grid reflection
- Warm amber spotlights on the stage
- Each franchise desk is color-coded to their team color
- IPL AUCTION 2027 LED wall behind the stage (animated)
- Crowd is instanced geometry — hundreds of silhouettes with subtle sway animation
- No motion blur, no heavy post-processing — clean and readable

**Quality tiers** (GPU-based detection):
```ts
type QualityTier = "ULTRA" | "HIGH" | "BALANCED" | "PERFORMANCE";

const qualityConfig = {
  ULTRA:       { shadows: true,  crowdCount: 400, particles: true,  ao: true  },
  HIGH:        { shadows: true,  crowdCount: 200, particles: true,  ao: false },
  BALANCED:    { shadows: false, crowdCount: 100, particles: false, ao: false },
  PERFORMANCE: { shadows: false, crowdCount: 0,   particles: false, ao: false },
};
```

---

### 4.2 Camera Director

#### [NEW] `engine/presentation/cameraDirector.ts`

```ts
type CameraShot = 
  | "WIDE_ROOM"        // full room overview — used during PLAYER_PRESENTATION
  | "STAGE_REVEAL"     // push in toward player card
  | "BID_FOCUS"        // cut to user's desk area
  | "RIVAL_REACTION"   // cut to leading rival's desk
  | "FINAL_CALL"       // slow push toward auctioneer podium, vignette
  | "HAMMER_SOLD"      // quick cut to winner's desk + burst effect
  | "PLAYER_PASSED"    // wide pull back, dim lighting

const shotSequence: Record<AuctionPhase, CameraShot[]> = {
  PLAYER_PRESENTATION: ["WIDE_ROOM", "STAGE_REVEAL"],
  FIRST_BID:          ["STAGE_REVEAL"],
  BIDDING:            ["BID_FOCUS", "RIVAL_REACTION"],
  FINAL_CALL:         ["FINAL_CALL"],
  SOLD:               ["HAMMER_SOLD"],
  PASSED:             ["PLAYER_PASSED"],
};
```

Camera transitions use smooth spring interpolation via `@react-three/drei`'s `CameraControls` or custom lerp. **Camera never teleports — always smooth**.

---

### 4.3 Event-Driven Visual Effects

#### [NEW] `components/auction/effects/`

- **`BidWaveEffect`**: When a team bids, a ripple emanates from their desk
- **`SoldBurst`**: Particle explosion + screen flash when player is SOLD
- **`FinalCallVignette`**: Gradual dark vignette + dramatic slow-motion feel
- **`TensionPulse`**: The stage spotlight pulses faster as tension increases
- **`DeskHighlight`**: Active bidder's desk glows in their franchise color

All effects are **event-driven** — triggered by `AuctionEvent` objects from the engine, not by polling state.

---

### 4.4 Franchise Cinematic Intro (upgrade)

#### [MODIFY] `app/franchise/[id]/intro/page.tsx`

Current intro is just text + button. Upgrade to:
- Full-screen team color gradient background (animated)
- Team badge animates in from center (scale + glow)
- Team name text reveals letter by letter
- 3 quick stat cards fly in: Philosophy, Home Ground, Retained Core
- "ENTER THE WAR ROOM →" button (or auto-continues after 8s)
- Fully skippable with ESC or SKIP button

This feels like a sports broadcast team reveal, not a loading screen.

---

### 4.5 Avatar System

The reference image shows player portrait avatars (stylized cartoon faces). Since we can't use real player photos:

#### [NEW] `components/auction/PlayerAvatar.tsx`
- Each player gets a deterministic color avatar generated from their name hash
- Avatar shows initials in a circle with role-colored background
- For the player card on center stage, the avatar is larger (80×80px)
- In the player list, avatars are small (32×32px)

Future: Replace with actual portrait assets when available.

---

### 4.6 Onboarding Screen Upgrades

#### Franchise Selection Hall upgrade
Current: Simple list with color cards.
Target: 

```
[10 FRANCHISE TILES in a grid]
Each tile:
  - Team color gradient background
  - Team badge / short name
  - City name
  - Philosophy label
  - Difficulty rating (●●●○○)
  - Quick stats: retained core count, purse

Selecting a tile:
  - Tile expands to show full profile card
  - Philosophy / Strengths / Needs / Retained core
  - Aura glow behind the selected tile
  - "COMPARE" button to side-by-side compare two teams
  - "ENTER FRANCHISE HQ →" confirm button
```

#### War Room upgrade
Current: Gap grid + target board works well.  
Add:
- **Purse allocation planner**: Visual breakdown of budget (retained deductions, target allocations, reserve)
- **Scarcity forecast**: "Only 4 death bowlers in the entire pool. 8 teams need one."
- **Retained squad display**: Show retained players with their deduction amounts

---

### Milestone 4 Quality Gate
- React Three Fiber scene renders at 60 FPS on HIGH tier on a mid-range Mac
- Quality tier switching works without auction restart
- Camera smoothly transitions between all 6 shot types
- Franchise cinematic intro plays, is skippable, and feels premium
- Bid wave / sold burst effects visible and not jarring
- Franchise selection hall shows all 10 teams with profile detail
- No Three.js errors in console

---

## Milestone 5 — Post-Auction Report, Polish & Game Completeness

**Goal**: The auction should feel complete, not abandoned. The post-auction report is the player's reward for a well-played auction.

---

### 5.1 Post-Auction Report Screen

#### [NEW] `app/auction/report/page.tsx`

**Report structure**:

```
┌─────────────────────────────────────────────────────────┐
│  AUCTION COMPLETE  ·  SEASON 2027                       │
│                                                         │
│  YOUR SQUAD GRADE                                       │
│           A+                                            │
│  "Elite squad with championship ceiling."               │
│                                                         │
│  ┌─────────────┬─────────────┬─────────────┐           │
│  │ SQUAD QUALITY│ ROLE COVER  │ BUY EFFIC.  │           │
│  │     89       │    94%      │    112%     │           │
│  └─────────────┴─────────────┴─────────────┘           │
│                                                         │
│  YOUR SQUAD  (sortable by role / price paid)            │
│  ─────────────────────────────────────────              │
│  R. Sharma    BAT    ₹ 8.00 CR  (FV: 13.4 · Steal ✨)  │
│  J. Bumrah    BOWL   ₹ 12 CR   (FV: 11.8 · Overpaid)  │
│  ...                                                    │
│                                                         │
│  AUCTION MOMENTS                                        │
│  ──────────────                                         │
│  🔥 STEAL    R. Sharma at ₹8 CR (40% below model)       │
│  ⚔️ BID WAR  J. Bumrah — 11 bids, 4 teams competing     │
│  💔 HEARTBREAK  S. Gill lost to MI at ₹ 14.5 CR         │
│                                                         │
│  RIVAL SQUADS (collapsible)                             │
│  All 10 final squads + grades                           │
│                                                         │
│  [REPLAY AUCTION]    [START NEW AUCTION]                │
└─────────────────────────────────────────────────────────┘
```

**Moments algorithm** (upgrade from current):
- STEAL: price ≤ 70% of fair value
- OVERPAY: price ≥ 135% of fair value  
- BID WAR: ≥ 6 bids on one player
- HEARTBREAK: user's target player, won by AI
- MASTERSTROKE: user wins a player at base price who was a critical need
- BUDGET EFFICIENCY: remaining purse vs. squad quality ratio

**Squad Grade** (upgrade from A/B/B+):
```ts
function gradeAuction(state): Grade {
  const qualityScore = avgOverall * 0.40;
  const coverageScore = roleCoverage * 0.30;
  const efficiencyScore = buyEfficiency * 0.20;
  const scarcityScore = criticalRolesFilled * 0.10;
  const total = qualityScore + coverageScore + efficiencyScore + scarcityScore;
  return total > 92 ? "S" : total > 85 ? "A+" : total > 78 ? "A" : total > 70 ? "B+" : total > 60 ? "B" : "C";
}
```

---

### 5.2 Rival Squads Comparison

After the auction, show all 10 team squads with their grades. The user should be able to see:
- What MI / CSK / RCB ended up with
- Which teams overpaid the most
- The leaderboard of squad grades across all 10 teams

This creates replay motivation: "I got A+, but CSK also got A+. Can I beat them next time?"

---

### 5.3 Sound Design

#### [NEW] `infrastructure/audio/audioDirector.ts`

A pure event-driven audio system (no Web Audio complexity — just HTMLAudio):

| Event | Sound |
|---|---|
| Player presentation | Dramatic reveal sting |
| First bid opens | Subtle room tension rise |
| Each bid placed | Quick gavel tap |
| Bid war (4+ bids) | Crowd murmur intensification |
| Final call | "Going once..." auctioneer voice or musical sting |
| SOLD | Gavel slam + crowd cheer burst |
| PASSED/Unsold | Deflated tone |
| User wins player | Victory sting |
| User loses player (heartbreak) | Soft loss tone |

Sound files: Source from royalty-free cricket/auction ambience. All sounds respect the `soundOn` toggle.

---

### 5.4 Keyboard Controls

A game without keyboard shortcuts feels like a prototype.

| Key | Action |
|---|---|
| `B` | Place bid (default increment) |
| `P` | Pass |
| `1` / `2` / `3` / `4` | Quick bid +0.25 / +0.50 / +1 / +2 |
| `Space` | Advance phase (fast-forward) |
| `Esc` | Close drawer / deselect player |
| `?` | Show keyboard shortcuts overlay |

#### [NEW] `hooks/useAuctionKeyboard.ts`

---

### 5.5 Accessibility

- All interactive elements have `aria-label`
- Reduced motion: `@media (prefers-reduced-motion: reduce)` — disables 3D animations, uses fade cuts
- High contrast mode support
- All text meets WCAG AA contrast ratios
- Screen reader announcements for phase changes (using `aria-live` regions)
- Keyboard focus management during phase transitions

---

### 5.6 Performance Optimizations

- Code-split the Three.js bundle (only loaded when entering `/auction`)
- Player data lazy-loaded (only needed after franchise selection)
- `React.memo` on `FranchiseDesk`, `PlayerRow`, `PlayerCard`
- Virtualize the player list (right panel) — 120+ rows without virtual scroll = janky
- `useDeferredValue` for search filtering

---

### Milestone 5 Quality Gate
- Post-auction report shows squad, grade, moments, and rival squads
- All 6 auction moment types detected correctly
- Sound plays on bid, sold, and passed events (respects toggle)
- Keyboard shortcuts B/P/1/2/3/4/Space/Esc all work
- Player list scrolls smoothly with 120+ players
- `aria-live` region announces phase changes
- Typecheck, lint, unit tests all pass
- Full auction playthrough from rules → setup → franchise → war room → auction → report works end-to-end

---

## File Change Summary

### New Files
| File | Purpose |
|---|---|
| `app/rules/page.tsx` | Rules screen (own route) |
| `app/setup/page.tsx` | Setup screen (own route) |
| `app/franchise/page.tsx` | Franchise selection (own route) |
| `app/franchise/[id]/intro/page.tsx` | Team cinematic (own route) |
| `app/war-room/page.tsx` | War room (own route) |
| `app/auction/page.tsx` | Live auction (own route) |
| `app/auction/report/page.tsx` | Post-auction report |
| `middleware.ts` | Navigation guard |
| `components/auction/LeftPanel.tsx` | Squad + purse panel |
| `components/auction/PlayerCard.tsx` | Center stage player display |
| `components/auction/PlayerAvatar.tsx` | Avatar component |
| `components/auction/FranchiseDesk.tsx` | Individual desk in 3D room |
| `components/auction/HighestBidBanner.tsx` | Current leader display |
| `components/auction/PhaseAnnouncement.tsx` | Dramatic phase text overlay |
| `components/auction/BidConsole.tsx` | Bid/pass controls |
| `components/auction/RightPanel.tsx` | Player table + rival intel |
| `components/auction/effects/BidWave.tsx` | Bid ripple effect |
| `components/auction/effects/SoldBurst.tsx` | Sale celebration effect |
| `engine/ai/aiBidder.ts` | AI decision making |
| `engine/ai/aiValuation.ts` | Contextual player value per franchise |
| `engine/auction/auctionTimer.ts` | Per-player countdown |
| `engine/auction/orderGenerator.ts` | Category-aware player ordering |
| `engine/squad/squadRules.ts` | Squad validation rules |
| `engine/random/seededRng.ts` | Named RNG streams |
| `engine/presentation/cameraDirector.ts` | Shot selection logic |
| `data/players/2027.ts` | 120+ player definitions |
| `data/teams/franchises.ts` | Franchise + AI profiles |
| `data/auction/categoryOrder.ts` | Auction set definitions |
| `infrastructure/audio/audioDirector.ts` | Event-driven audio |
| `hooks/useAuctionKeyboard.ts` | Keyboard shortcut handler |

### Modified Files
| File | Change |
|---|---|
| `app/page.tsx` | Boot screen only — strip all other screens |
| `app/layout.tsx` | Add font optimization, meta |
| `components/auction/AuctionRoomCanvas.tsx` | Rebuild as Three.js R3F scene |
| `engine/auctionEngine.ts` | Add timer integration, category tracking, remove AI |
| `engine/auctionPresentation.ts` | Expand moments, scarcity, rival intelligence |
| `stores/gameStore.ts` | Add timer state, IndexedDB save |
| `stores/onboardingStore.ts` | Add category tracking, cookie persistence |
| `data/mockData.ts` | Expand to 120+ players or split into `data/players/` |

---

## Open Questions for User Review

> [!IMPORTANT]
> **Timer**: Should the per-player timer be on by default? The reference shows a timer. Should it be configurable off (for people who want to think longer)?

> [!IMPORTANT]
> **Three.js in Milestone 4**: The current Canvas 2D room could be kept for Milestones 1–3 and Three.js added in Milestone 4. This is the recommended approach — the layout and logic improvements in Milestones 1–3 don't need Three.js. Do you want Three.js introduced earlier?

> [!IMPORTANT]
> **Player Data**: The 120+ player pool requires creating realistic (but simulation-labeled) stats. Should players be based on real IPL cricketers (clearly labeled as "simulation projections") or fully fictional? The existing 18 are real players.

> [!IMPORTANT]
> **Milestone order**: Do you want me to start with Milestone 1 (routing + data) immediately, or is there a specific milestone you want to prioritize first?

---

## Non-Negotiable Standards (carried from existing docs)

1. Every rupee decision has opportunity cost — no free actions
2. AI gets harder by making smarter decisions, not by receiving more money
3. Real stats and simulation projections are visually distinct at all times
4. The 3D scene degrades gracefully (quality tiers) without degrading the strategy
5. Same seed + same decisions = identical auction outcome, always
6. Navigation cannot bypass required game setup steps
