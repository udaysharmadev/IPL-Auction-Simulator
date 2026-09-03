# IPL Auction Simulator 2027

A strategic cricket auction simulation where you build a championship IPL squad one bid at a time. Face 9 AI-powered rival franchises in an immersive auction room experience.

## Features

- **166 Players** — 70 curated stars + 96 generated prospects across all roles
- **10 Franchises** — Full IPL roster with unique franchise profiles and strategies
- **AI Rivals** — Intelligent bidding opponents with psychology-based decision making
- **3 Auction Formats** — Authentic (₹50 Cr), Quick (compact pool), Custom (sandbox)
- **4 Difficulty Levels** — Rookie, Strategist, Expert, GM
- **Immersive Auction Room** — Canvas-rendered scene with camera shots, tension meter, and lighting
- **Player Intelligence** — Detailed scouting drawer with stats, valuations, and data provenance
- **Squad Management** — Real-time role coverage, overseas limits, and purse tracking
- **Auction Report** — Post-auction grading with quality, coverage, and efficiency metrics
- **Keyboard Shortcuts** — `B` Bid, `P` Pass, `Space` Advance, `S` Sound
- **Sound Effects** — Web Audio API synthesized auction sounds
- **Share & Export** — Share squad reports via Web Share API or download as text
- **Offline-First** — IndexedDB persistence survives page refresh and browser crashes
- **PWA Ready** — Installable with manifest and icons
- **Accessible** — ARIA labels, keyboard navigation, screen reader support
- **Mobile Optimized** — Responsive from iPhone SE to desktop

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run Vitest test suite |

## Architecture

```
app/              # Next.js App Router pages
components/       # React UI components
data/             # Player data, franchise configs, auction rules
domain/           # Pure domain logic (onboarding, rules, rendering)
engine/           # Auction engine, AI bidders, squad rules
hooks/            # React hooks (keyboard, multi-tab sync)
infrastructure/   # Persistence layer (IndexedDB)
lib/              # Utilities (sounds, share, exports)
schemas/          # Zod validation schemas
stores/           # Zustand state management
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **State**: Zustand with persistence
- **Styling**: Custom CSS (Barlow Condensed + DM Sans)
- **Icons**: Lucide React
- **Testing**: Vitest
- **Canvas**: HTML5 Canvas API
- **Audio**: Web Audio API

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `B` | Place bid at next increment |
| `P` | Pass on current player |
| `Space` | Advance auction one turn |
| `S` | Toggle sound effects |
| `1` `2` `3` | Quick bid increments |

## License

Private project. All player data is projected/simulated for the 2027 IPL season.
