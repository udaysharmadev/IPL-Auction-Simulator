# IPL Auction Simulator 2027 — Advanced Three-Phase Implementation Plan

## Product flow locked for all phases

```text
BOOT / DEVICE CHECK
        ↓
IPL RULES & REGULATIONS
        ↓
AUCTION FORMAT + DIFFICULTY
        ↓
FRANCHISE SELECTION
        ↓
FRANCHISE CINEMATIC INTRO
        ↓
WAR ROOM / SQUAD GAP ANALYSIS
        ↓
SCOUTING + TARGETS + MAX BIDS
        ↓
LIVE 3D AUCTION
        ↓
POST-AUCTION REPORT
        ↓
PLAYING XI / SEASON / CAREER
```

The Rules & Regulations screen is not a decorative tutorial. It is the first game configuration checkpoint and must create a versioned `RuleSetSnapshot` used by every engine. A user can never enter franchise selection without an active ruleset.

Because the official 2027 auction rules may change, the UI must show:

- rules version and verification date;
- official/verified versus simulation/custom labels;
- purse, squad limits, overseas limits, retentions, RTM, accelerated-round rules and bid increments;
- an acknowledgement button: `I Understand — Choose Franchise`;
- a comparison toggle for `Authentic` and `Custom Simulation`;
- source links only after the source has been verified.

## Target architecture

The application should use a deterministic, event-driven, layered architecture.

```text
React / Next.js screens               React Three Fiber scene
            ↓                                  ↓
          Application command and query layer
                             ↓
        Pure deterministic domain engines in TypeScript
                             ↓
       Domain events → event log → derived game state
                             ↓
 Local persistence / IndexedDB / future server adapters
                             ↓
       Versioned datasets, rulesets and asset manifests
```

### Mandatory boundaries

1. `domain/` contains types, invariants and pure rules. No React, browser, Three.js or storage imports.
2. `engine/` contains deterministic systems and accepts explicit seed/time inputs.
3. `application/` handles commands such as `PlaceBid`, `PassPlayer`, `SelectFranchise` and `AcceptRules`.
4. `stores/` exposes read models and selectors. Zustand must not become the rules engine.
5. `presentation/` renders state and dispatches commands; it never changes purses or squads directly.
6. `infrastructure/` contains IndexedDB, analytics, data import, audio and future API adapters.
7. `components/3d/` consumes a presentation model and is never authoritative for auction state.

### Command/event pattern

```text
User or AI intent
    ↓
GameCommand
    ↓
Validation against RuleSet + current aggregate
    ↓
DomainEvents
    ↓
Reducer creates next state
    ↓
UI, audio, camera and persistence react to events
```

Example:

```ts
type GameCommand =
  | { type: "RULES_ACCEPTED"; rulesVersion: string }
  | { type: "FRANCHISE_SELECTED"; franchiseId: string }
  | { type: "BID_PLACED"; teamId: string; amount: Money }
  | { type: "PLAYER_PASSED"; teamId: string }

type DomainEvent =
  | { type: "BidAccepted"; teamId: string; playerId: string; amount: Money }
  | { type: "BidRejected"; reason: BidRejectionReason }
  | { type: "PlayerSold"; teamId: string; playerId: string; amount: Money }
```

The event log enables replay, debugging, deterministic tests, analytics, save migration and future multiplayer verification.

---

# Phase 1 — Elite Foundation, Rules Onboarding and Strategy Setup

## Goal

Deliver a stable game shell that begins with a premium rules experience, continues through franchise selection and ends in a complete pre-auction war room. At the end of Phase 1, all future auction work sits on a strong deterministic foundation.

## 1.1 Screen and routing architecture

Create real routes instead of one giant page:

```text
/                         Cinematic title and continue
/rules                    Rules & regulations
/setup                    Auction type, difficulty and seed
/franchise                Franchise selection
/franchise/[id]/intro     Team cinematic
/war-room                 Squad analysis and targets
/auction                  Live auction
/auction/report           Post-auction report
/dev/simulation           Developer simulation console
```

Introduce a guarded navigation state machine:

```text
BOOT
→ RULES_REQUIRED
→ CONFIGURATION_REQUIRED
→ FRANCHISE_REQUIRED
→ WAR_ROOM_READY
→ AUCTION_READY
→ AUCTION_ACTIVE
→ AUCTION_COMPLETE
```

Direct route access must redirect to the earliest incomplete checkpoint.

## 1.2 Rules & Regulations experience

Build a premium broadcast-style rules chamber with five concise sections:

1. Auction Format — mini/mega/custom, player categories and accelerated round.
2. Money — starting purse, bid increments, minimum budget safety and RTM economics.
3. Squad Construction — minimum/maximum squad, overseas cap and role requirements.
4. Franchise Setup — retained/released players and purse deductions.
5. Authenticity — verified data, projected data and current rules version.

UX requirements:

- cinematic rule cards rather than a long legal page;
- persistent progress rail (`1 of 5`);
- keyboard controls and reduced-motion version;
- glossary tooltips for RTM, capped, uncapped, retention and accelerated round;
- first visit requires acknowledgement; later visits allow quick review;
- no unverified 2027 rule may be labeled official.

Create a fully configurable rules model:

```ts
type AuctionRuleSet = {
  id: string
  version: string
  status: "VERIFIED" | "PROJECTED" | "CUSTOM"
  effectiveSeason: number
  startingPurse: Money
  minSquadSize: number
  maxSquadSize: number
  maxOverseas: number
  retentionRules: RetentionRule[]
  rtmRules: RtmRuleSet
  bidIncrementBands: BidIncrementBand[]
  categoryOrder: AuctionCategoryRule[]
  acceleratedRound: AcceleratedRoundRule
  sources: SourceReference[]
}
```

## 1.3 Franchise selection and cinematic introduction

Build a ten-franchise selection hall:

- 3D team plinths with hover spotlight and material animation;
- current squad composition, remaining purse and difficulty indicator;
- philosophy preview: balanced, youth-heavy, star-heavy, analytics or rebuild;
- major needs and retained core;
- compare two teams side by side;
- confirm dialog explaining that choosing a team changes contextual player values.

After confirmation, play a 6–10 second skippable franchise intro before entering the war room.

## 1.4 Data and rules infrastructure

Replace the single mock file with validated packages:

```text
data/
  manifests/
  players/2027.projected.json
  teams/2027.json
  rules/2027.projected.json
  sources/source-registry.json
  assets/player-assets.json
schemas/
  player.schema.ts
  team.schema.ts
  rule-set.schema.ts
  save.schema.ts
```

Use Zod at ingestion boundaries. Invalid data must fail during development/build rather than crash during bidding.

Every player field that may be factual must carry provenance or point to a source record. Simulation ratings must include a model version.

## 1.5 Deterministic engine foundation

Split the current engine into independently tested modules:

```text
domain/
  money.ts
  player.ts
  franchise.ts
  rules.ts
  events.ts
engine/
  auction/auctionMachine.ts
  auction/bidPolicy.ts
  auction/orderGenerator.ts
  valuation/contextualValue.ts
  scarcity/scarcityIndex.ts
  squad/squadRules.ts
  ai/personality.ts
  random/seededRng.ts
```

Use named RNG streams so a camera animation or UI call can never change AI outcomes:

```text
auction-order
ai-decisions
market-variance
auction-events
season-simulation
```

## 1.6 War room

The war room should provide:

- retained squad and open slots;
- role coverage radar;
- purse allocation planner;
- target list, max bids and alternatives;
- scarcity forecast;
- player intelligence drawer;
- visible separation of verified statistics and projected impact;
- “Ready for Auction” validation summary.

## 1.7 Phase 1 graphics foundation

Create the visual technology pipeline before building expensive scenes:

- React Three Fiber + Three.js;
- GLTF/GLB asset standard;
- Draco or Meshopt geometry compression;
- KTX2/Basis texture compression;
- physically based materials with a controlled material library;
- baked environment lighting plus a small dynamic-light budget;
- quality tiers: Ultra, High, Balanced and Performance;
- GPU capability detection and automatic quality recommendation;
- centralized camera director, audio director and effects director;
- accessibility controls for motion, flashes and camera shake.

## Phase 1 quality gate

- Rules always appear before franchise selection on a new save.
- Deep links cannot bypass required setup.
- Same rules, player data, decisions and seed produce identical results.
- No purse or squad rule lives in a React component.
- Data schemas reject duplicates, invalid roles and impossible prices.
- War room produces a valid target plan.
- Typecheck, lint and unit tests pass.
- Desktop UI maintains 60 FPS outside heavy transition moments.

---

# Phase 2 — Next-Level 3D Auction, Intelligent AI and Cinematic Game Feel

## Goal

Turn the foundation into the signature experience: a premium, tense, replayable 3D auction in which nine AI franchises respond strategically and every major bid creates a story.

## 2.1 Auction room graphics

Build the room as optimized scene systems rather than one model:

```text
AuctionEnvironment
├── Architecture and stage
├── Central display system
├── Auctioneer podium
├── Ten franchise desks
├── Crowd sectors
├── Lighting rigs
├── Atmospherics
├── Camera rails
└── Event-driven effects
```

Visual direction:

- modern Indian sports-broadcast luxury;
- dark teal/graphite architecture, warm amber bid lighting and franchise accents;
- volumetric-looking baked light shafts, restrained bloom and contact shadows;
- animated LED ribbons and data screens;
- reflective floor with controlled roughness, not a mirror;
- subtle depth of field only during presentation moments;
- stylized, legally safe franchise identity pack until licensed assets are available.

## 2.2 Camera director

Create a deterministic shot-selection service using auction events:

```text
PlayerPresented  → stage reveal → player screen close-up
FirstBid         → bidding team desk
UserBid          → user POV → bid confirmation
RivalCounter     → rival reaction → price screen
FinalCall        → slow push toward podium
PlayerSold       → hammer → winning desk → squad update
RecordSale       → wide celebration crane shot
```

Rules:

- shots have priorities, minimum durations and interruption rules;
- repeated low-value lots use shortened coverage;
- users can skip or use fast-forward;
- reduced motion replaces camera travel with cuts/fades;
- gameplay input remains responsive while shots play.

## 2.3 Crowd and character performance

- Instanced low-poly crowd with palette and animation variation.
- Crowd divided into reaction sectors rather than individually simulated spectators.
- Auctioneer animation state machine: idle, introduce, invite, acknowledge, final call, hammer and sold.
- Team desk representatives use a small reusable animation set.
- Reactions derive from domain events and price context.
- Object pooling for paddles, particles and transient effects.

## 2.4 Audio architecture

Use an event-driven mixer:

```text
Master
├── Music
├── Room ambience
├── Crowd
├── Auctioneer
├── Franchise reactions
├── UI
└── Impact / hammer
```

Music has calm, interest, bid-war, final-call and sale layers. Transitions should use intensity parameters rather than restarting tracks.

## 2.5 Advanced AI architecture

Each AI franchise receives:

- stable philosophy weights;
- contextual squad-needs model;
- dynamic player value;
- alternatives graph;
- budget reservation plan;
- remaining-category forecast;
- scarcity sensitivity;
- temporary psychology state;
- user behavior memory;
- explainability trace.

AI decision pipeline:

```text
Update squad needs
→ estimate contextual player value
→ calculate marginal squad value
→ compare alternatives and future supply
→ reserve budget for unresolved critical roles
→ apply personality and psychology
→ model rival/user threat
→ produce maximum bid and confidence
→ bid, wait or exit
```

AI must run in a Web Worker so simulation bursts do not stall rendering. The worker receives immutable snapshots and returns intents; the main deterministic engine validates every AI bid.

## 2.6 Auction economics

Implement:

- bid bands from ruleset;
- contextual fair value by franchise;
- role scarcity index;
- market inflation/deflation;
- replacement value;
- minimum viable remaining budget;
- category alternatives;
- late-auction panic;
- unsold and accelerated-round eligibility;
- RTM/retention hooks even if disabled in the first playable ruleset.

## 2.7 Auction presentation UI

Desktop layout:

- left: franchise purse, squad, needs and targets;
- center: 3D scene, player presentation and auction status;
- right: player market, alternatives and rival needs;
- bottom: primary bid console with manual, smart-max and optional auto-bid.

Add contextual warnings:

- `Above your planned maximum`;
- `Only one viable death bowler remains`;
- `This purchase leaves insufficient reserve for minimum squad size`;
- `Rival likely near maximum`;
- `Projected overpay: 22%`.

Warnings advise; they never block a legal strategic decision.

## 2.8 Replay and post-auction analysis

The domain event log generates:

- auction timeline;
- longest bid war;
- steal, overpay, heartbreak, masterstroke and panic buy;
- best and worst decisions;
- counterfactual comparison;
- final squad grade;
- shareable result card;
- deterministic replay mode using event timestamps and camera cues.

## 2.9 Performance budget

Targets for the auction route:

- initial interactive shell under 3 seconds on a good desktop connection;
- auction scene loaded progressively after the rules/franchise flow;
- 60 FPS target, 45 FPS minimum on balanced tier;
- total visible draw calls below approximately 180 on balanced tier;
- compressed initial auction 3D payload below approximately 15 MB;
- no single uncompressed texture above 4K;
- no more than two important dynamic shadow casters;
- simulation work longer than 4 ms moved off the render thread;
- memory pressure detector can downgrade crowd density and post-processing.

## Phase 2 quality gate

- A complete auction can be played without invalid budgets or deadlocks.
- Nine AI franchises finish with materially different strategies.
- AI considers alternatives and reserves money for missing roles.
- Auction replay reproduces the event sequence.
- Camera/audio/lighting respond to events without controlling game logic.
- Performance tier switching works without restarting the auction.
- 1,000 seeded simulations meet economy and squad-completion thresholds.
- Visual review reads as a premium sports venue, not a generic Three.js scene.

---

# Phase 3 — Franchise Career, Deep Simulation and Production-Grade Platform

## Goal

Expand the excellent auction into a replayable franchise-management game while hardening the system for long saves, content updates, analytics, accessibility and future multiplayer.

## 3.1 Post-auction squad and playing XI

- Drag-and-drop batting order.
- Captain, vice-captain and wicketkeeper selection.
- Bowling phase allocation: powerplay, middle and death.
- Impact/substitute rule controlled by active ruleset.
- Real-time XI analysis for batting depth, pace, spin, fielding and matchup coverage.
- Bench and overseas-limit validation.

## 3.2 Match and season engine

Use a possession/event-style statistical simulation rather than one strength roll:

```text
Pre-match conditions
→ team selection
→ innings phases
→ batter/bowler matchups
→ tactical decisions
→ pressure and form
→ outcome events
→ scorecard and highlights
```

The simulation runs headlessly and emits match events. Presentation can initially show a fast scorecard/highlight experience and later support richer visualization without rewriting the engine.

## 3.3 Career systems

- player form, fitness, workload and injuries;
- age curves and development uncertainty;
- staff and facility upgrades;
- board objectives and job confidence;
- franchise finances and reputation;
- fan sentiment and game-generated media;
- player availability and replacement logic;
- annual retention/release/auction cycle;
- multi-season history and records.

Every career subsystem should be optional through feature flags and ruleset configuration so Quick Auction stays fast.

## 3.4 Save architecture

Use IndexedDB for the primary local save and localStorage only for small boot preferences.

Save format:

```ts
type GameSave = {
  saveVersion: string
  dataVersion: string
  rulesVersion: string
  simulationVersion: string
  assetManifestVersion: string
  seed: string
  snapshot: GameState
  eventLogTail: DomainEvent[]
  checksum: string
  createdAt: string
  updatedAt: string
}
```

Requirements:

- transactional checkpoints after purchases and phase transitions;
- rotating recovery slots;
- migrations between save versions;
- corrupted save detection;
- export/import save file;
- future cloud adapter without changing engine code.

## 3.5 Data pipeline and admin tooling

Create CLI/admin workflows for CSV/JSON import:

```text
source files
→ schema validation
→ identity matching and duplicate detection
→ normalization
→ provenance merge
→ simulation profile generation
→ review report
→ versioned data package
```

The admin surface should display differences before publishing a dataset and never mutate a live dataset silently.

## 3.6 Developer simulation laboratory

`/dev/simulation` should support:

- 100 / 1,000 / 10,000 auction batches;
- deterministic seed replay;
- AI explainability traces;
- economy distributions;
- role coverage heatmaps;
- budget failure and deadlock detection;
- strategy-vs-strategy comparison;
- player price distributions;
- export to CSV/JSON;
- regression comparison against a baseline simulation version.

## 3.7 Testing strategy

Testing pyramid:

1. Domain unit tests — every invariant and state transition.
2. Property tests — budgets never negative, no duplicate ownership, legal squad limits.
3. Seed snapshot tests — same version/seed/commands produce the same event hash.
4. Simulation tests — thousands of auctions and seasons.
5. Component tests — critical forms and bidding controls.
6. Playwright end-to-end — rules → franchise → auction → report → reload recovery.
7. Visual regression — rules screen, franchise hall and major auction states.
8. Performance tests — route payload, frame time and worker latency budgets.

CI blocks merging when an invariant, deterministic hash or budget regression fails.

## 3.8 Observability and live balancing

Track anonymous gameplay metrics only with explicit consent:

- auction completion rate;
- average bid count and auction length;
- player price distribution;
- AI overpay and panic frequency;
- user pass/bid behavior;
- squad completion and role coverage;
- save failures, crashes, FPS tier and asset load failures.

Balance configuration must be versioned. Never modify old career outcomes invisibly.

## 3.9 Future multiplayer readiness

Do not build multiplayer in Phase 3, but preserve these boundaries:

- commands are serializable;
- events have monotonic sequence numbers;
- engine is deterministic and headless;
- user identity is not embedded in domain objects;
- bidding supports an external authoritative command source;
- saves distinguish local authority from future server authority.

## Phase 3 quality gate

- User can complete an auction, build an XI and simulate a season.
- Multi-season saves migrate and recover safely.
- Player development, injury and match output remain deterministic by seed/version.
- 10,000 headless simulations complete without invariant violations.
- Rules and dataset updates do not corrupt old saves.
- Quick Auction remains fast despite career systems existing.
- Accessibility audit covers keyboard, contrast, reduced motion, text scaling and sound indicators.
- Architecture can accept a server-authoritative multiplayer adapter without rewriting the core engine.

---

# Recommended repository after the three phases

```text
app/
  (marketing)/
  rules/
  setup/
  franchise/
  war-room/
  auction/
  career/
  dev/simulation/
application/
  commands/
  queries/
  services/
components/
  3d/
  auction/
  rules/
  franchise/
  war-room/
  ui/
domain/
  auction/
  player/
  franchise/
  rules/
  season/
engine/
  ai/
  auction/
  valuation/
  scarcity/
  squad/
  match/
  season/
  career/
  random/
infrastructure/
  persistence/
  data/
  audio/
  analytics/
  workers/
data/
  players/
  teams/
  rules/
  sources/
schemas/
stores/
tests/
  unit/
  property/
  simulation/
  e2e/
public/
  models/
  textures/
  audio/
  fonts/
docs/
```

# Delivery sequence

Each phase should be delivered in small vertical slices, not as one giant branch.

## Phase 1 slices

1. RuleSet schema and route guards.
2. Rules & Regulations screen.
3. Franchise selection hall.
4. Command/event architecture and deterministic RNG streams.
5. War room, targets and auction readiness validation.
6. Data validation and initial save snapshot.

## Phase 2 slices

1. Optimized auction room and quality tiers.
2. Event-driven auction state machine.
3. Camera/audio/effects directors.
4. AI value, need and alternatives models.
5. Bid console, smart max and auction warnings.
6. Replay, moments and post-auction report.
7. 1,000-auction balance pass and performance polish.

## Phase 3 slices

1. Squad and XI builder.
2. Headless match engine and highlights.
3. Season flow and standings.
4. Development, injury and form.
5. Career saves, migrations and recovery.
6. Simulation laboratory, analytics and admin data tools.

# Non-negotiable definition of success

- The game always teaches the active IPL rules before asking the user to choose a franchise.
- The visual experience feels like a premium televised sports event.
- The auction remains strategically readable underneath every cinematic effect.
- AI gets harder by making better decisions, never by receiving hidden money.
- Every authoritative gameplay result is deterministic, versioned and testable.
- Real information and simulated projections are never visually confused.
- The 3D scene can degrade gracefully without degrading the strategy game.
- Every rupee spent feels like a decision with opportunity cost.
