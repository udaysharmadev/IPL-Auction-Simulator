"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, CircleHelp, FastForward, Gavel, Search, Settings2, Shield, Sparkles, Volume2, VolumeX, X, ArrowRight, Check, ChevronLeft, LockKeyhole, Play, SlidersHorizontal, Target, Zap, MapPin, Users, Crown, AlertTriangle, BrainCircuit, Activity, History, Gauge, Eye, Flame, Keyboard, MessageCircle, Mic, MicOff, Trophy } from "lucide-react";
import { FRANCHISES, PLAYERS } from "@/data/mockData";
import { FRANCHISE_PROFILES } from "@/data/franchiseProfiles";
import { RULE_SET, RULE_SET_SNAPSHOT } from "@/data/rules";
import { type AuctionFormat, type Difficulty, type GraphicsQuality } from "@/domain/onboarding";
import { auctionFormatDescription, auctionMatchesSession, resolveAuctionSession } from "@/engine/setup/sessionConfig";
import { gradeAuction, isUserBidder, nextBid as calculateNextBid } from "@/engine/auctionEngine";
import { auctionMoments, bidCountForCurrent, scarcityFor, shotFor, warningsFor } from "@/engine/auctionPresentation";
import { useGameStore } from "@/stores/gameStore";
import { setupDefaults, useOnboardingStore } from "@/stores/onboardingStore";
import { AuctionRoomCanvas } from "@/components/auction/AuctionRoomCanvas";
import { PlayerPortrait } from "@/components/auction/PlayerPortrait";
import { bidderRoster, currentPlayerFor, marketRoundFor, peerActivityFor } from "@/components/auction/auctionViewModel";
import { playerDataDisclosure } from "@/data/sources/playerSources";
import { buildAuctionResult, shareSquadReport, downloadSquadReport } from "@/lib/share";
import { useAuctionKeyboard } from "@/hooks/useAuctionKeyboard";
import { useAuctionImmersive } from "@/hooks/useAuctionImmersive";
import dynamic from "next/dynamic";

const Scene3D = dynamic(() => import("@/components/auction/Scene3D").then((m) => m.Scene3D), { ssr: false });

const formatCr = (value: number) => `₹${value.toFixed(value % 1 === 0 ? 0 : 2)} Cr`;
const PEER_RESPONSE_DELAY_MS = 1400;

export default function AuctionScreen() {
  const { auction, currentRoute, hydrate, bid, pass, advance, reset, toggleSound, setMaxBid, toggleSmartMax, hydrationStatus } = useGameStore();
  const onboarding = useOnboardingStore();
  const [franchiseId, setFranchiseId] = useState(onboarding.franchiseId ?? "KKR");
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [toast, setToast] = useState("Auction room ready");
  const [peerResponseState, setPeerResponseState] = useState<"IDLE" | "SCHEDULED" | "PAUSED">("IDLE");
  const [peerResponseRemainingMs, setPeerResponseRemainingMs] = useState(0);
  const peerResponseTimeoutRef = useRef<number | null>(null);
  const peerResponseIntervalRef = useRef<number | null>(null);
  const observedLotRef = useRef<string | null>(null);
  const scheduledUserEventRef = useRef<string | null>(null);
  const markReady = useOnboardingStore((state) => state.markReady);
  const markAuctionComplete = useOnboardingStore((state) => state.markAuctionComplete);
  const router = useRouter();
  const auctionSeed = onboarding.setup?.seed ?? setupDefaults.seed;
  const auctionMatchesSelection = auctionMatchesSession(auction, franchiseId, onboarding.setup ?? auctionSeed);

  useAuctionKeyboard(auction, { bid, pass, advance, toggleSound });
  const { commentary, auctioneerLine, toggleAudio } = useAuctionImmersive(auction, auction?.soundOn ?? false);
  useEffect(() => { if (onboarding.franchiseId && onboarding.franchiseId !== franchiseId) setFranchiseId(onboarding.franchiseId); }, [onboarding.franchiseId, franchiseId]);

  const clearPeerResponseTimer = useCallback((nextState: "IDLE" | "PAUSED" = "IDLE") => {
    if (peerResponseTimeoutRef.current !== null) window.clearTimeout(peerResponseTimeoutRef.current);
    if (peerResponseIntervalRef.current !== null) window.clearInterval(peerResponseIntervalRef.current);
    peerResponseTimeoutRef.current = null;
    peerResponseIntervalRef.current = null;
    setPeerResponseRemainingMs(0);
    setPeerResponseState(nextState);
  }, []);

  const respondToPeers = useCallback((message = "Rival tables are responding") => {
    clearPeerResponseTimer();
    advance();
    setToast(message);
  }, [advance, clearPeerResponseTimer]);

  const pausePeerResponse = useCallback(() => {
    clearPeerResponseTimer("PAUSED");
    setToast("Rival response held — resume when ready");
  }, [clearPeerResponseTimer]);

  /**
   * The engine intentionally exposes one AI market round per advanceAuction
   * call. A user bid therefore opens a short, observable response window
   * instead of silently draining the entire market. FIRST_BID is never
   * auto-advanced: the user always gets the first decision.
   */
  useEffect(() => {
    if (typeof window === "undefined" || hydrationStatus !== "ready" || !auction || !auctionMatchesSelection) {
      clearPeerResponseTimer();
      return;
    }

    const lotKey = `${auction.currentIndex}:${auction.currentPlayerId}`;
    const latestEvent = auction.events.at(-1);
    if (observedLotRef.current !== lotKey) {
      observedLotRef.current = lotKey;
      scheduledUserEventRef.current = latestEvent?.id ?? null;
      clearPeerResponseTimer();
      return;
    }

    const userBidNeedsResponse = auction.phase === "BIDDING"
      && auction.highestBidder === "YOU"
      && latestEvent?.type === "bid"
      && latestEvent.actor === "YOU"
      && latestEvent.playerId === auction.currentPlayerId;

    if (!userBidNeedsResponse || !latestEvent?.id || scheduledUserEventRef.current === latestEvent.id) {
      if (!userBidNeedsResponse) clearPeerResponseTimer();
      return;
    }

    scheduledUserEventRef.current = latestEvent.id;
    const dueAt = Date.now() + PEER_RESPONSE_DELAY_MS;
    setPeerResponseState("SCHEDULED");
    setPeerResponseRemainingMs(PEER_RESPONSE_DELAY_MS);
    peerResponseIntervalRef.current = window.setInterval(() => {
      setPeerResponseRemainingMs(Math.max(0, dueAt - Date.now()));
    }, 100);
    peerResponseTimeoutRef.current = window.setTimeout(() => {
      clearPeerResponseTimer();
      advance();
      setToast("Rival tables have responded");
    }, PEER_RESPONSE_DELAY_MS);

    return () => {
      if (peerResponseTimeoutRef.current !== null) window.clearTimeout(peerResponseTimeoutRef.current);
      if (peerResponseIntervalRef.current !== null) window.clearInterval(peerResponseIntervalRef.current);
      peerResponseTimeoutRef.current = null;
      peerResponseIntervalRef.current = null;
      // React Strict Mode mounts effects twice in development. Releasing the
      // event identity here lets the second mount schedule the same response
      // exactly once while still preventing duplicate timers on real updates.
      if (scheduledUserEventRef.current === latestEvent?.id) scheduledUserEventRef.current = null;
    };
  }, [advance, auction, auctionMatchesSelection, clearPeerResponseTimer, hydrationStatus]);

  useEffect(() => () => clearPeerResponseTimer(), [clearPeerResponseTimer]);

  useEffect(() => { hydrate(franchiseId, onboarding.setup ?? auctionSeed); }, [auctionSeed, franchiseId, hydrate, onboarding.setup]);
  useEffect(() => { if (toast === "Auction room ready") return; const id = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(id); }, [toast]);
  useEffect(() => {
    if (hydrationStatus !== "ready" || !auctionMatchesSelection || currentRoute !== "/auction/report" || !auction?.completed) return;
    if (!onboarding.auctionComplete) markAuctionComplete();
    router.replace("/auction/report");
  }, [auction?.completed, auctionMatchesSelection, currentRoute, hydrationStatus, onboarding.auctionComplete, markAuctionComplete, router]);

  const current = auction ? currentPlayerFor(auction) : undefined;
  const activePlayers = useMemo(() => {
    const activePlayerIds = auction?.playerPoolIds ?? auction?.order;
    if (!activePlayerIds?.length) return PLAYERS;
    const activeIds = new Set(activePlayerIds);
    return PLAYERS.filter((player) => activeIds.has(player.playerId));
  }, [auction?.order, auction?.playerPoolIds]);
  const playerRows = useMemo(() => activePlayers.filter((p) => {
    const matchesQuery = `${p.identity.name} ${p.role.primary} ${p.identity.nationality}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "ALL" || p.role.primary === filter || (filter === "OVERSEAS" && p.auctionData.nationalityStatus === "OVERSEAS") || (filter === "INDIAN" && p.auctionData.nationalityStatus === "INDIAN");
    return matchesQuery && matchesFilter;
  }), [activePlayers, filter, query]);

  useEffect(() => {
    if (!auction || !current || auction.userMaxBid !== null) return;
    const target = onboarding.targets.find((item) => item.playerId === current.playerId);
    if (target) setMaxBid(target.maxBid);
  }, [auction, current, onboarding.targets, setMaxBid]);

  if (hydrationStatus !== "ready" || !auction || !current) return <div className="boot-screen"><div className="boot-mark">27</div><span>LOADING AUCTION SAVE</span></div>;
  const team = FRANCHISES.find((f) => f.id === auction.userFranchiseId) ?? FRANCHISES[0];
  const selected = selectedPlayer ? activePlayers.find((p) => p.playerId === selectedPlayer) : undefined;
  const rules = auction.ruleSet;
  const bidderRows = bidderRoster(auction);
  const peerActivity = peerActivityFor(auction);
  const marketRound = marketRoundFor(auction);
  const peerResponseSeconds = Math.ceil(peerResponseRemainingMs / 1000);
  const peerResponsePending = peerResponseState === "SCHEDULED";
  const peerResponsePaused = peerResponseState === "PAUSED";
  const activeBandIndex = rules.auction.bidIncrementBands.findIndex((band) => auction.currentBid < band.below);
  const activeIncrement = rules.auction.bidIncrementBands[activeBandIndex]?.increment ?? 1;
  const nextIncrement = rules.auction.bidIncrementBands[activeBandIndex + 1]?.increment;
  const quickIncrements = auction.currentBid === 0 ? [] : [...new Set([activeIncrement, nextIncrement].filter((increment): increment is number => typeof increment === "number"))];
  const userHasPassed = auction.bidderStates?.[auction.userFranchiseId]?.status === "FOLDED";
  const userIsLeading = Boolean(auction.highestBidder && isUserBidder(auction, auction.highestBidder));
  const canBid = (auction.phase === "BIDDING" || auction.phase === "FIRST_BID" || auction.phase === "FINAL_CALL") && !userIsLeading && !userHasPassed;
  const nextBid = auction.currentBid === 0 ? current.auctionData.basePrice : calculateNextBid(auction.currentBid, rules);
  const scarcity = scarcityFor(auction);
  const warnings = warningsFor(auction, current);
  const cameraShot = shotFor(auction);
  const bidCount = bidCountForCurrent(auction);
  const moments = auctionMoments(auction);
  const currentTarget = onboarding.targets.find((target) => target.playerId === current.playerId);

  function act(action: () => void, message: string) { action(); setToast(message); }

  const report = auction.completed ? gradeAuction(auction) : null;
  return <main className="app-shell" role="main" aria-label="IPL Auction Simulator">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">27</div><div><div className="eyebrow">IPL AUCTION SIMULATOR</div><strong>FRANCHISE HQ <span>•</span> 2027</strong></div></div>
      <div className="topbar-actions"><div className="live-pill"><i /> LIVE AUCTION</div><button className="icon-button" title="Notifications"><Bell size={17} /></button><button className="icon-button" title="Settings"><Settings2 size={17} /></button><button className="icon-button" title="Help"><CircleHelp size={17} /></button><div className="avatar">U</div></div>
    </header>

    <section className="room-grid">
      <aside className="sidebar left-panel" aria-label="Your franchise dashboard">
        <div className="panel-title"><span>YOUR FRANCHISE</span><button className="text-button" onClick={() => { markReady(); reset(franchiseId, onboarding.setup ?? auctionSeed); setToast("Franchise reset"); }}><span>RESET</span></button></div>
        <div className="franchise-picker"><Shield size={17} /><select value={franchiseId} disabled aria-label="Selected franchise">{FRANCHISES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select><LockKeyhole size={13} /></div>
        <div className="team-identity"><div className="team-crest" style={{ background: team.color }}>{team.shortName}</div><div><div className="team-name">{team.name}</div><div className="team-meta">{team.city} <span>•</span> {auction.difficulty ?? "STRATEGIST"} MODE</div></div></div>
        <div className="purse-block"><div><span>AVAILABLE PURSE</span><strong>{formatCr(auction.userBudget)}</strong></div><div className="purse-meter"><span style={{ width: `${Math.min(100, auction.userBudget / rules.auction.startingPurse * 100)}%` }} /></div><small>{Math.round(auction.userBudget / rules.auction.startingPurse * 100)}% remaining</small></div>
        <div className="mini-stats"><div><span>SQUAD</span><strong>{auction.userSquad.length}<em>/{rules.auction.maxSquadSize}</em></strong></div><div><span>OVERSEAS</span><strong>{auction.userSquad.filter((id) => activePlayers.find((p) => p.playerId === id)?.auctionData.nationalityStatus === "OVERSEAS").length}<em>/{rules.auction.maxOverseas}</em></strong></div></div>
        <div className="needs"><div className="panel-title"><span>SQUAD NEEDS</span><span className="muted">{auction.needs.filter((n) => n.priority === "A").length} PRIORITY</span></div>{auction.needs.map((need) => <div className="need-row" key={need.role}><span className={`need-dot ${need.priority.toLowerCase()}`} /><div><strong>{need.label}</strong><small>{need.priority === "A" ? "Critical gap" : "Nice to have"}</small></div><b>{need.count}</b></div>)}</div>
        <div className="target-box"><div className="target-icon"><Sparkles size={16} /></div><div><strong>YOUR AUCTION PLAN</strong><small>{currentTarget ? `${current.identity.shortName}: ceiling ${formatCr(currentTarget.maxBid)}` : `${onboarding.targets.length} targets tracked from your war room`}</small></div><span className="target-status">LIVE</span></div>
      </aside>

      <section className="auction-stage-wrap" aria-label="Auction stage">
        <div className="scene-toolbar"><div className="scene-label"><span className="pulse" /> AUCTION FLOOR <span className="slash">/</span> ROUND {marketRound}{peerResponsePending && <span className="peer-response-badge"><i /> RIVALS RESPONDING · {peerResponseSeconds}s</span>}{peerResponsePaused && <span className="peer-response-badge paused"><i /> RESPONSE PAUSED</span>}</div><div className="scene-actions"><button className="scene-control" title="Toggle sound" onClick={toggleSound}>{auction.soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>{peerResponsePending ? <button className="scene-control" title="Pause rival response" onClick={pausePeerResponse}><span className="pause-glyph">Ⅱ</span></button> : <button className="scene-control" title="Advance one market turn" onClick={() => respondToPeers("Auction advanced one market turn")} disabled={auction.phase === "FIRST_BID" || userHasPassed}><FastForward size={15} /></button>}{peerResponsePaused && <button className="scene-control" title="Resume rival response" onClick={() => respondToPeers("Rival response resumed")}><Play size={14} /></button>}</div></div>
        <div className={`auction-scene shot-${cameraShot.toLowerCase()}`}>
          <div className="scene-3d">
            <Scene3D tension={auction.tension} phase={auction.phase} accentColor={team.color} currentBid={auction.currentBid} highestBidder={auction.highestBidder} isSold={auction.phase === "SOLD"} isPassed={auction.phase === "PASSED"} />
          </div>
          <div className="shot-badge"><Eye size={13} /> {cameraShot.replaceAll("_", " ")}</div><div className="tension-meter"><span><Flame size={13} /> TENSION</span><div><i style={{ width: `${auction.tension}%` }} /></div><b>{auction.tension}</b></div>
          {commentary && <div className="commentary-bar"><div className="commentary-text">{commentary}</div>{auctioneerLine && <div className="auctioneer-text"><Mic size={10} style={{ marginRight: 4, verticalAlign: "middle" }} />{auctioneerLine}</div>}</div>}
          <div className="ceiling-lights"><i /><i /><i /><i /><i /></div><div className="back-wall"><div className="wall-logo">IPL <span>27</span></div><div className="wall-copy">THE BID<br /><b>BEGINS</b></div><div className="wall-lines" /></div>
          <div className="stage-platform"><div className="stage-screen player-entrance" key={current.playerId}><div className="screen-kicker">NOW ON THE BLOCK <span>•</span> {auction.category}</div><div className="stage-player-portrait"><PlayerPortrait player={current} size={74} teamId={team.id} showRoleBadge showRating /></div><div className="screen-name">{current.identity.name.toUpperCase()}</div><div className="screen-role">{roleLabel(current.role.primary)} <span>•</span> {current.identity.nationality} <span>•</span> {current.auctionData.cappedStatus}</div><div className="screen-price">{auction.currentBid > 0 ? formatCr(auction.currentBid) : `Base ${formatCr(current.auctionData.basePrice ?? 1)}`}</div></div><div className="podium"><div className="podium-top"><Gavel size={19} /><span>AUCTIONEER</span></div><div className="podium-face" /></div></div>
          <div className="room-floor"><div className="desk user-desk"><span className="desk-team">{team.shortName}</span><div className="desk-screen">{formatCr(auction.userBudget)}</div><small className="desk-status">YOUR TABLE</small></div>{bidderRows.filter((bidder) => bidder.team.id !== franchiseId).map((bidder, i) => <div className={`desk ai-desk d${(i % 9) + 1} ${bidder.status.toLowerCase()}`} key={bidder.team.id}><span className="desk-team">{bidder.team.shortName}</span><div className="desk-screen">{formatCr(bidder.budget)}</div><small className="desk-status">{bidder.status === "WATCHING" ? "MONITORING" : bidder.status.replaceAll("_", " ")}</small></div>)}</div>
          <div className="scene-status"><div className="status-event">{auction.message}</div><div className="status-round"><span>LOT {String(auction.currentIndex + 1).padStart(2, "0")}</span><b>{auction.remainingPlayers} PLAYERS REMAINING</b></div></div>
        </div>
        <div className="league-market-strip" aria-label="Live franchise bidder status">{bidderRows.map((bidder) => <div className={`market-team ${bidder.status.toLowerCase()} ${bidder.team.id === team.id ? "is-user" : ""}`} key={bidder.team.id}><span className="market-team-mark" style={{ background: bidder.team.colors.primary }}>{bidder.team.shortName}</span><div><strong>{bidder.team.shortName}</strong><small>{bidder.team.id === team.id ? "YOUR TABLE" : bidder.status.replaceAll("_", " ")}</small></div><b>{formatCr(bidder.budget)}</b></div>)}</div>
        <div className="auction-intel-strip"><div className="scarcity-radar"><div className="intel-strip-label"><Activity size={13} /> MARKET SCARCITY</div>{(["BOWL", "BAT", "AR", "WK"] as const).map((role) => <div className={`scarcity-chip ${scarcity[role].severity.toLowerCase()}`} key={role}><span>{role}</span><b>{scarcity[role].remaining}</b></div>)}</div><div className="war-detail"><BrainCircuit size={14} /><span>{auction.aiTrace ? auction.aiTrace.reason : `${bidderRows.filter((bidder) => bidder.status !== "FOLDED" && bidder.status !== "SQUAD_LOCKED" && bidder.status !== "BUDGET_LOCKED").length} tables remain active in this market.`}</span></div></div>
        {warnings.length > 0 && <div className="auction-warning-stack">{warnings.slice(0, 2).map((warning) => <div className={`auction-warning ${warning.level.toLowerCase()}`} key={warning.title}><AlertTriangle size={14} /><div><strong>{warning.title}</strong><span>{warning.detail}</span></div></div>)}</div>}
        <div className="bid-console" role="region" aria-label="Bidding controls"><div className="current-bid"><span>CURRENT BID <em>{bidCount} BIDS</em></span><strong>{auction.currentBid ? formatCr(auction.currentBid) : "Opening bid"}</strong><small>{userIsLeading ? "You are leading" : auction.highestBidder ? `${auction.highestBidder} is leading` : "All tables can enter"}</small></div><div className="bid-actions" role="group" aria-label="Bid actions">{quickIncrements.map((increment) => <button className="bid-secondary" key={increment} disabled={!canBid || peerResponsePending} onClick={() => act(() => bid(increment), `Bid placed at ${formatCr(auction.currentBid === 0 ? current.auctionData.basePrice : auction.currentBid + increment)}`)} aria-label={`Bid ${formatCr(auction.currentBid === 0 ? current.auctionData.basePrice : auction.currentBid + increment)}`}>+{increment.toFixed(2)}</button>)}<button className="bid-primary" disabled={!canBid || peerResponsePending} onClick={() => act(() => bid(), `Bid placed at ${formatCr(nextBid)}`)} aria-label={`Place bid at ${formatCr(nextBid)}`}><Gavel size={18} /> BID {formatCr(nextBid)}</button><button className="pass-button" disabled={peerResponsePending || userHasPassed || !(auction.phase === "BIDDING" || auction.phase === "FIRST_BID" || auction.phase === "FINAL_CALL")} onClick={() => act(pass, "You passed on this player")} aria-label="Pass on this player"><X size={17} /> PASS</button></div><div className="bid-hint">{peerResponsePending ? `Rival tables are considering their response (${peerResponseSeconds}s)` : auction.phase === "FINAL_CALL" ? "Final call — one more bid could change your squad." : <span><Keyboard size={11} style={{ marginRight: 4, verticalAlign: "middle" }} /> <kbd>B</kbd> Bid <kbd>P</kbd> Pass <kbd>Space</kbd> Advance <kbd>S</kbd> Sound</span>}</div><div className="max-bid-control"><label>MAX BID</label><div><span>₹</span><input aria-label="Maximum bid" type="number" min={rules.auction.bidIncrementBands[0]?.increment ?? 0.25} step={rules.auction.bidIncrementBands[0]?.increment ?? 0.25} value={auction.userMaxBid ?? ""} placeholder={currentTarget ? currentTarget.maxBid.toFixed(2) : "Set ceiling"} onChange={(event) => setMaxBid(event.target.value ? Number(event.target.value) : null)} /><span>Cr</span></div><button className={auction.smartMaxEnabled ? "smart-active" : ""} onClick={toggleSmartMax}><Gauge size={13} /> SMART MAX {auction.smartMaxEnabled ? "ON" : "OFF"}</button></div></div>
      </section>

      <aside className="sidebar right-panel" aria-label="Player market"><div className="panel-title"><span>PLAYER MARKET</span><span className="market-count">{playerRows.length} PLAYERS</span></div><div className="search-box"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players" aria-label="Search players by name, role, or nationality" /></div><div className="filter-row" role="group" aria-label="Filter players by role">{["ALL", "BAT", "BOWL", "AR", "WK", "OVERSEAS"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}</button>)}</div><div className="player-list phase-two-list" role="list" aria-label="Available players">{playerRows.map((p) => <button className={`player-row ${p.playerId === current.playerId ? "on-block" : ""}`} key={p.playerId} onClick={() => setSelectedPlayer(p.playerId)} role="listitem" aria-label={`${p.identity.shortName}, ${roleLabel(p.role.primary)}, ${p.identity.nationality}, Overall ${p.simulationData.overall}`}><PlayerPortrait player={p} size={34} /><div className="player-row-info"><strong>{p.identity.shortName}</strong><small>{roleLabel(p.role.primary)} <span>•</span> {p.identity.nationality}</small></div><div className="player-row-rating"><b>{p.simulationData.overall}</b><small>{formatCr(p.auctionData.basePrice ?? 1)}</small></div></button>)}</div><div className="peer-market"><div className="timeline-title"><Users size={13} /> ALL-TEAM MARKET RESPONSE</div>{bidderRows.filter((bidder) => bidder.team.id !== team.id).map((bidder) => <div className={`peer-team-row ${bidder.status.toLowerCase()}`} key={bidder.team.id}><span className="peer-mark" style={{ borderColor: bidder.team.colors.primary, color: bidder.team.colors.secondary }}>{bidder.team.shortName}</span><div><strong>{bidder.status.replaceAll("_", " ")}</strong><small>{bidder.lastBid ? `Last ${formatCr(bidder.lastBid)}` : `${formatCr(bidder.budget)} available`}</small></div><b>{bidder.bidCount}</b></div>)}</div><div className="live-timeline"><div className="timeline-title"><History size={13} /> LIVE EVENT LOG</div>{auction.events.slice(-6).reverse().map((event) => <div className={`timeline-event ${event.type}`} key={event.id}><i /><span>{event.text}</span></div>)}</div>{peerActivity.length > 0 && <div className="ai-trace peer-trace"><div className="timeline-title"><BrainCircuit size={13} /> PEER DECISIONS</div>{peerActivity.slice(0, 5).map((activity, index) => { const peer = FRANCHISES.find((franchise) => franchise.id === activity.teamId || franchise.shortName === activity.teamId); const needScore = "needScore" in activity && typeof activity.needScore === "number" ? Math.round(activity.needScore) : null; return <div className={`peer-decision ${String(activity.status).toLowerCase()}`} key={activity.id ?? `${activity.teamId}-${index}`}><span>{peer?.shortName ?? activity.teamId}</span><div><strong>{activity.status}</strong><small>{activity.bid ? formatCr(activity.bid) : activity.reason ?? "No bid submitted"}</small></div>{needScore !== null && <b>{needScore}</b>}</div>; })}</div>}<div className="market-footer"><span>{auction.dataVersion} • {rules.status}</span><button className="text-button" onClick={() => setSelectedPlayer(current.playerId)}>PLAYER INTEL <Sparkles size={13} /></button></div></aside>
    </section>
    {selected && (() => { const disclosure = playerDataDisclosure(selected); return <div className="drawer-backdrop" onClick={() => setSelectedPlayer(null)} role="dialog" aria-modal="true" aria-label={`Player intelligence: ${selected.identity.name}`}><div className="intel-drawer" onClick={(e) => e.stopPropagation()}><button className="drawer-close" onClick={() => setSelectedPlayer(null)} aria-label="Close player intelligence"><X size={18} /></button><div className="drawer-head"><PlayerPortrait player={selected} size={64} /><div><div className="eyebrow">PLAYER INTELLIGENCE <span className="verified">{disclosure.label.toUpperCase()}</span></div><h2>{selected.identity.name}</h2><p>{roleLabel(selected.role.primary)} • {selected.identity.nationality} • Age {selected.identity.age}</p></div></div><div className="player-facts"><span>{selected.role.battingStyle}</span><span>{selected.role.bowlingStyle ?? "No specialist bowling"}</span><span>{selected.role.specialization ?? roleLabel(selected.role.primary)}</span><span>{selected.auctionData.availability} AVAILABILITY</span></div><div className="intel-grid"><div><span>PUBLIC OVERALL</span><strong>{selected.simulationData.overall}</strong></div><div><span>FAIR VALUE</span><strong>{formatCr(selected.valuation.fairValue)}</strong></div><div><span>CONFIDENCE</span><strong>{selected.valuation.confidence}%</strong></div><div><span>SCARCITY</span><strong>{selected.valuation.scarcity}</strong></div></div><div className="drawer-section"><div className="section-label">{disclosure.label.toUpperCase()}</div><p className="projection-copy disclosure-detail">{disclosure.detail}</p><div className="stat-line"><span>Matches</span><b>{selected.realData.iplMatches}</b><span>Runs</span><b>{selected.realData.runs}</b><span>Wickets</span><b>{selected.realData.wickets}</b></div><div className="stat-line stat-line-secondary"><span>Strike rate</span><b>{selected.realData.strikeRate ?? "—"}</b><span>Economy</span><b>{selected.realData.economy ?? "—"}</b><span>Catches</span><b>{selected.realData.catches ?? "—"}</b></div></div><div className="drawer-section"><div className="section-label">SIMULATION PROJECTION</div><p className="projection-copy">{selected.valuation.reason}</p><div className="progress-row"><span>Potential</span><div><i style={{ width: `${selected.simulationData.potential}%` }} /></div><b>{selected.simulationData.potential}</b></div><div className="progress-row"><span>Consistency</span><div><i style={{ width: `${selected.simulationData.consistency}%` }} /></div><b>{selected.simulationData.consistency}</b></div></div><div className="asset-provenance">PORTRAIT {selected.assets.portrait.kind} • {selected.assets.portrait.sourceRef ?? selected.assets.manifestVersion}</div><button className="drawer-action" onClick={() => { setToast(`${selected.identity.shortName} added to targets`); setSelectedPlayer(null); }}>ADD TO TARGETS <Sparkles size={16} /></button></div></div>; })()}
    {report && <div className="drawer-backdrop report-backdrop" role="dialog" aria-modal="true" aria-label="Auction complete - squad report"><div className="report-card"><div className="eyebrow">AUCTION COMPLETE <span className="verified">SEASON 2027</span></div><div className="report-grade">{report.grade}</div><h2>Your squad report is ready.</h2><p>The room is quiet. Your decisions are now on the board.</p><div className="report-metrics"><div><span>SQUAD QUALITY</span><strong>{report.quality}</strong></div><div><span>ROLE COVERAGE</span><strong>{report.coverage}</strong></div><div><span>BUDGET EFFICIENCY</span><strong>{report.efficiency}</strong></div></div>{moments.length > 0 && <div className="report-moments"><div className="timeline-title"><Flame size={13} /> AUCTION MOMENTS</div>{moments.slice(0, 3).map((moment) => <div className="moment-row" key={`${moment.type}-${moment.playerId}`}><span>{moment.type}</span><div><strong>{moment.title}</strong><small>{moment.detail}</small></div></div>)}</div>}<div style={{ display: "flex", gap: 8, marginTop: 16 }}><button className="drawer-action" style={{ flex: 1 }} onClick={() => { markReady(); reset(franchiseId, onboarding.setup ?? auctionSeed); router.push("/auction"); }}>RUN A NEW AUCTION <FastForward size={16} /></button></div><div style={{ display: "flex", gap: 8, marginTop: 8 }}><button className="drawer-action" style={{ flex: 1, background: "rgba(110,208,189,.12)", borderColor: "rgba(110,208,189,.3)", color: "#6ed0bd" }} onClick={() => auction && shareSquadReport(buildAuctionResult(auction))}>SHARE REPORT</button><button className="drawer-action" style={{ flex: 1, background: "rgba(110,208,189,.12)", borderColor: "rgba(110,208,189,.3)", color: "#6ed0bd" }} onClick={() => auction && downloadSquadReport(buildAuctionResult(auction))}>DOWNLOAD</button></div></div></div>}
    {toast && <div className="toast"><span className="toast-dot" />{toast}</div>}
    <button className={`audio-toggle ${!auction.soundOn ? "muted" : ""}`} onClick={() => { toggleSound(); toggleAudio(); }} aria-label={auction.soundOn ? "Mute auction sounds" : "Enable auction sounds"} title={auction.soundOn ? "Mute sounds" : "Enable sounds"}>
      {auction.soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
  </main>;
}

function roleLabel(role: string) { return role === "AR" ? "ALL-ROUNDER" : role === "WK" ? "WICKETKEEPER" : role === "BAT" ? "BATTER" : "BOWLER"; }

export function AuctionReportScreen() {
  const router = useRouter();
  const { auction, hydrate, reset, hydrationStatus } = useGameStore();
  const onboarding = useOnboardingStore();
  const markReady = useOnboardingStore((state) => state.markReady);
  const auctionSeed = onboarding.setup?.seed ?? setupDefaults.seed;
  const hydrationMatchesSelection = hydrationStatus === "ready" && auctionMatchesSession(auction, onboarding.franchiseId, onboarding.setup ?? auctionSeed);
  const report = auction?.completed ? gradeAuction(auction) : null;
  const moments = auction ? auctionMoments(auction) : [];

  useEffect(() => {
    if (!onboarding.franchiseId) return;
    hydrate(onboarding.franchiseId, onboarding.setup ?? auctionSeed);
  }, [auctionSeed, hydrate, onboarding.franchiseId, onboarding.setup]);

  useEffect(() => {
    if (!hydrationMatchesSelection || auction?.completed) return;
    // The cookie may outlive a missing/corrupt save. Clear the terminal
    // checkpoint before redirecting so middleware cannot bounce back here.
    markReady();
    router.replace("/auction");
  }, [auction?.completed, hydrationMatchesSelection, markReady, router]);

  if (!hydrationMatchesSelection || !report || !auction) return <div className="boot-screen"><div className="boot-mark">27</div><span>LOADING SQUAD REPORT</span></div>;
  return <main className="onboarding-shell report-shell"><div className="drawer-backdrop report-backdrop"><div className="report-card"><div className="eyebrow">AUCTION COMPLETE <span className="verified">SEASON 2027</span></div><div className="report-grade">{report.grade}</div><h2>Your squad report is ready.</h2><p>The room is quiet. Your decisions are now on the board.</p><div className="report-metrics"><div><span>SQUAD QUALITY</span><strong>{report.quality}</strong></div><div><span>ROLE COVERAGE</span><strong>{report.coverage}</strong></div><div><span>BUDGET EFFICIENCY</span><strong>{report.efficiency}</strong></div></div>{moments.length > 0 && <div className="report-moments"><div className="timeline-title"><Flame size={13} /> AUCTION MOMENTS</div>{moments.slice(0, 3).map((moment) => <div className="moment-row" key={`${moment.type}-${moment.playerId}`}><span>{moment.type}</span><div><strong>{moment.title}</strong><small>{moment.detail}</small></div></div>)}</div>}<div style={{ display: "flex", gap: 8, marginTop: 16 }}><button className="drawer-action" style={{ flex: 1 }} onClick={() => { markReady(); reset(auction.userFranchiseId, onboarding.setup ?? auctionSeed); router.push("/auction"); }}>RUN A NEW AUCTION <FastForward size={16} /></button></div><div style={{ display: "flex", gap: 8, marginTop: 8 }}><button className="drawer-action" style={{ flex: 1, background: "rgba(110,208,189,.12)", borderColor: "rgba(110,208,189,.3)", color: "#6ed0bd" }} onClick={() => shareSquadReport(buildAuctionResult(auction))}>SHARE REPORT</button><button className="drawer-action" style={{ flex: 1, background: "rgba(110,208,189,.12)", borderColor: "rgba(110,208,189,.3)", color: "#6ed0bd" }} onClick={() => downloadSquadReport(buildAuctionResult(auction))}>DOWNLOAD</button></div></div></div></main>;
}

function FlowHeader({ step, eyebrow, title, detail }: { step: string; eyebrow: string; title: string; detail: string }) {
  return <header className="flow-header"><div className="flow-brand"><div className="brand-mark">27</div><div><div className="eyebrow">IPL AUCTION SIMULATOR</div><strong>FRANCHISE HQ <span>•</span> 2027</strong></div></div><div className="flow-progress"><span className="flow-step active">01</span><i /><span className={`flow-step ${step === "02" || step === "03" || step === "04" ? "active" : ""}`}>02</span><i /><span className={`flow-step ${step === "03" || step === "04" ? "active" : ""}`}>03</span><i /><span className={`flow-step ${step === "04" ? "active" : ""}`}>04</span></div><div className="flow-account"><span className="live-pill"><i /> LOCAL SESSION</span><div className="avatar">U</div></div><div className="flow-intro"><div className="eyebrow">{eyebrow} <span className="verified">{step} / 04</span></div><h1>{title}</h1><p>{detail}</p></div></header>;
}

function FlowFooter({ back, next, nextIcon = <ArrowRight size={16} />, disabled = false, onBack, onNext }: { back?: string; next: string; nextIcon?: React.ReactNode; disabled?: boolean; onBack?: () => void; onNext: () => void }) {
  return <footer className="flow-footer"><div>{back && <button className="ghost-button" onClick={onBack}><ChevronLeft size={16} /> {back}</button>}</div><button className="primary-flow-button" disabled={disabled} onClick={onNext}>{next} {nextIcon}</button></footer>;
}

export function RulesScreen() {
  const { acceptRules, resetOnboarding } = useOnboardingStore();
  const router = useRouter();
  const [active, setActive] = useState(0);
  const section = RULE_SET.sections[active];
  return <main className="onboarding-shell rules-shell"><FlowHeader step="01" eyebrow="BEFORE YOU BID" title="Know the rules. Own the room." detail="The 2027 framework defines the limits, the pressure and the consequences. Read the rules that govern every rupee before choosing your franchise." /><section className="rules-layout"><aside className="rules-rail"><div className="rail-label">RULEBOOK <span>{RULE_SET.version}</span></div>{RULE_SET.sections.map((item, index) => <button key={item.id} className={`rule-nav ${active === index ? "active" : ""}`} onClick={() => setActive(index)}><span>{item.number}</span><div><strong>{item.shortTitle}</strong><small>{index === 0 ? "The auction" : index === 1 ? "Purse pressure" : index === 2 ? "Build legally" : index === 3 ? "Team continuity" : "Play responsibly"}</small></div>{active > index && <Check size={14} />}</button>)}<div className="rules-source"><span className="source-badge"><Shield size={14} /> DATA STATUS</span><strong>Projected framework</strong><p>Official 2027 materials may update this ruleset. Any uncertain item remains labeled.</p><small>Last reviewed {RULE_SET.updatedAt}</small></div></aside><article className="rule-detail"><div className="rule-visual"><div className="rule-orbit orbit-one" /><div className="rule-orbit orbit-two" /><div className="rule-emblem"><span>{section.number}</span><Gavel size={32} /></div><div className="rule-visual-copy"><span>RULE {section.number}</span><strong>{section.shortTitle.toUpperCase()}</strong></div></div><div className="rule-copy"><div className="eyebrow">{section.number} / {section.id}</div><h2>{section.title}</h2><p>{section.summary}</p><div className="rule-points">{section.points.map((point) => <div className="rule-point" key={point.label}><span>{point.label}</span><strong>{point.value}</strong><small>{point.note}</small></div>)}</div></div><div className="rule-nav-actions"><button className="ghost-button" disabled={active === 0} onClick={() => setActive((value) => value - 1)}><ChevronLeft size={16} /> Previous</button><button className="outline-flow-button" disabled={active === RULE_SET.sections.length - 1} onClick={() => setActive((value) => value + 1)}>Next rule <ArrowRight size={15} /></button></div></article></section><FlowFooter back="Exit" next="I Understand — Configure Auction" nextIcon={<ArrowRight size={16} />} onBack={() => { resetOnboarding(); router.replace("/rules"); }} onNext={() => { acceptRules(); router.push("/setup"); }} /></main>;
}

export function SetupScreen() {
  const { setup, updateSetup, rewindTo } = useOnboardingStore();
  const router = useRouter();
  const [config, setConfig] = useState(setup ?? { format: "AUTHENTIC" as AuctionFormat, difficulty: "STRATEGIST" as Difficulty, graphicsQuality: "HIGH" as GraphicsQuality, seed: "2027-AUCTION-847293", rulesVersion: RULE_SET.version });
  const formatMeta = auctionFormatDescription(config.format);
  return <main className="onboarding-shell setup-shell"><FlowHeader step="02" eyebrow="CONFIGURE YOUR SEASON" title="Set the conditions." detail="Your ruleset is locked. Tune the competitive environment before you choose the franchise that must live inside it." /><section className="setup-layout"><div className="setup-main"><div className="section-heading"><div><div className="eyebrow">AUCTION PROFILE</div><h2>How do you want to play?</h2></div><span className="verified">RULES {RULE_SET.version}</span></div><div className="option-grid format-grid">{([['AUTHENTIC', 'Authentic 2027', 'Full projected player pool and strict squad pressure', Shield], ['QUICK', 'Quick Auction', '48-player compact pool with an 8-player squad target', Zap], ['CUSTOM', 'Custom Sandbox', '75 Cr purse and expanded overseas flexibility', SlidersHorizontal]] as const).map(([id, title, desc, Icon]) => <button type="button" key={id} className={`option-card ${config.format === id ? "selected" : ""}`} aria-pressed={config.format === id} onClick={() => setConfig((value) => ({ ...value, format: id as AuctionFormat }))}><div className="option-icon"><Icon size={19} /></div><div><strong>{title}</strong><small>{desc}</small></div><span className="option-radio" /></button>)}</div><div className="setup-divider" /><div className="setup-columns"><div><div className="eyebrow">AI INTELLIGENCE</div><h3>Difficulty</h3><div className="segmented-control">{([['ROOKIE', 'Rookie'], ['STRATEGIST', 'Strategist'], ['EXPERT', 'Expert'], ['GM', 'GM']] as const).map(([id, label]) => <button type="button" key={id} className={config.difficulty === id ? "active" : ""} aria-pressed={config.difficulty === id} onClick={() => setConfig((value) => ({ ...value, difficulty: id as Difficulty }))}>{label}</button>)}</div><p className="field-help">Rookie adds valuation variance; GM protects reserves and reacts faster to scarcity.</p></div><div><div className="eyebrow">RENDERING PROFILE</div><h3>Graphics quality</h3><div className="segmented-control">{([['ULTRA', 'Ultra'], ['HIGH', 'High'], ['BALANCED', 'Balanced'], ['PERFORMANCE', 'Performance']] as const).map(([id, label]) => <button type="button" key={id} className={config.graphicsQuality === id ? "active" : ""} aria-pressed={config.graphicsQuality === id} onClick={() => setConfig((value) => ({ ...value, graphicsQuality: id as GraphicsQuality }))}>{label}</button>)}</div><p className="field-help">Controls the auction-room effects budget and can be changed for a new run.</p></div></div></div><aside className="setup-preview"><div className="preview-kicker"><span className="pulse" /> SESSION PREVIEW</div><div className="preview-number">{formatMeta.duration}<small>MINUTES</small></div><div className="preview-rule"><span>PLAYER POOL</span><strong>{formatMeta.poolLabel}</strong></div><div className="preview-rule"><span>DIFFICULTY</span><strong>{config.difficulty}</strong></div><div className="preview-rule"><span>ROOM QUALITY</span><strong>{config.graphicsQuality}</strong></div><div className="preview-rule"><span>RULES STATUS</span><strong>{formatMeta.rulesLabel}</strong></div><div className="seed-box"><span>AUCTION SEED</span><strong>{config.seed}</strong><small>Same seed + same choices = same market.</small></div><div className="preview-stamp"><Check size={14} /> READY TO CHOOSE</div></aside></section><FlowFooter back="Rules" next="Choose Franchise" onBack={() => { rewindTo("RULES"); router.push("/rules"); }} onNext={() => { updateSetup(resolveAuctionSession(config).setup); router.push("/franchise"); }} /></main>;
}

export function FranchiseScreen() {
  const { franchiseId, selectFranchise, rewindTo } = useOnboardingStore();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(franchiseId ?? "KKR");
  const selected = FRANCHISE_PROFILES[selectedId];
  const selectedTeam = FRANCHISES.find((team) => team.id === selectedId) ?? FRANCHISES[0];
  return <main className="onboarding-shell franchise-shell"><FlowHeader step="03" eyebrow="CHOOSE YOUR FRANCHISE" title="This is your room now." detail="Every franchise has a different problem to solve. Choose the badge whose pressure you understand best." /><section className="franchise-layout"><div className="franchise-stage"><div className="stage-grid" /><div className="team-halo" style={{ background: `radial-gradient(circle, ${selectedTeam.color}88, transparent 65%)` }} /><div className="team-monolith" style={{ borderColor: selectedTeam.color, boxShadow: `0 0 90px ${selectedTeam.color}55` }}><div className="monolith-top">{selectedTeam.city.toUpperCase()} <span>•</span> {selectedTeam.shortName}</div><div className="monolith-mark" style={{ background: selectedTeam.color }}>{selectedTeam.shortName}</div><div className="monolith-bottom">2027 FRANCHISE LICENSE</div></div><div className="stage-caption"><span>SELECTED FRANCHISE</span><strong>{selectedTeam.name}</strong></div></div><aside className="franchise-picker-panel"><div className="picker-heading"><div><div className="eyebrow">THE TEN ROOMS</div><h2>Select a franchise</h2></div><span className="muted">{FRANCHISES.length} AVAILABLE</span></div><div className="franchise-list">{FRANCHISES.map((team) => { const profile = FRANCHISE_PROFILES[team.id]; return <button key={team.id} className={`franchise-option ${selectedId === team.id ? "selected" : ""}`} onClick={() => setSelectedId(team.id)}><div className="franchise-option-mark" style={{ background: team.color }}>{team.shortName}</div><div><strong>{team.name}</strong><small>{profile.philosophy}</small></div><ChevronDown size={15} /></button>; })}</div><div className="selected-philosophy"><div className="eyebrow">FRANCHISE DNA</div><h3>{selected.philosophy}</h3><p>{selected.description}</p><div className="dna-tags">{selected.strengths.map((strength) => <span key={strength}>{strength}</span>)}</div></div></aside></section><FlowFooter back="Configure" next="Enter Franchise HQ" onBack={() => { rewindTo("SETUP"); router.push("/setup"); }} onNext={() => { selectFranchise(selectedId); router.push(`/franchise/${encodeURIComponent(selectedId)}/intro`); }} /></main>;
}

export function IntroScreen() {
  const { franchiseId, completeIntro, rewindTo } = useOnboardingStore();
  const router = useRouter();
  const team = FRANCHISES.find((item) => item.id === franchiseId) ?? FRANCHISES[0];
  const profile = FRANCHISE_PROFILES[team.id];
  const enter = () => { completeIntro(); router.push("/war-room"); };
  return <main className="onboarding-shell intro-shell" style={{ "--intro-accent": team.color } as React.CSSProperties}><div className="intro-scanlines" /><div className="intro-center"><div className="eyebrow">WELCOME TO {team.city.toUpperCase()}</div><div className="intro-crest" style={{ background: team.color }}>{team.shortName}</div><h1>{team.name}</h1><p>{profile.description}</p><div className="intro-meta"><span><MapPin size={14} /> {team.city}</span><span><Crown size={14} /> {profile.philosophy}</span><span><Users size={14} /> 9 rivals watching</span></div><button className="primary-flow-button intro-button" onClick={enter}>ENTER THE WAR ROOM <ArrowRight size={16} /></button></div><button className="skip-intro" onClick={enter}>SKIP INTRO <FastForward size={14} /></button><div className="intro-corner intro-corner-left">FRANCHISE HQ / 2027</div><div className="intro-corner intro-corner-right">{team.shortName} {"//"} AUTHORIZED GM</div></main>;
}

export function WarRoomScreen() {
  const { franchiseId, setup, targets, setTargets, markReady, rewindTo } = useOnboardingStore();
  const router = useRouter();
  const team = FRANCHISES.find((item) => item.id === franchiseId) ?? FRANCHISES[0];
  const profile = FRANCHISE_PROFILES[team.id];
  const session = resolveAuctionSession(setup);
  const sessionPlayers = session.players;
  const [selectedRole, setSelectedRole] = useState("BOWL");
  const roleLabels: Record<string, string> = { BAT: "Batting depth", BOWL: "Death bowling", AR: "All-round cover", WK: "Wicketkeeper" };
  const ready = targets.length >= 2;
  function addTarget(role: string) { const candidate = sessionPlayers.find((player) => player.role.primary === role && !targets.some((target) => target.playerId === player.playerId)); if (candidate) setTargets([...targets, { playerId: candidate.playerId, priority: targets.length === 0 ? "A" : "B", maxBid: candidate.valuation.fairValue }]); }
  function removeTarget(playerId: string) { setTargets(targets.filter((target) => target.playerId !== playerId)); }
  return <main className="onboarding-shell war-shell"><FlowHeader step="04" eyebrow="FRANCHISE WAR ROOM" title="Build the plan before the noise." detail={`${team.shortName} enters the auction with a ${profile.philosophy.toLowerCase()} identity. Solve the gaps before the room starts moving.`} /><section className="war-layout"><aside className="war-identity"><div className="war-team-crest" style={{ background: team.color }}>{team.shortName}</div><div className="eyebrow">YOUR FRANCHISE</div><h2>{team.name}</h2><p>{profile.description}</p><div className="war-readout"><div><span>PURSE</span><strong>{formatCr(session.rules.auction.startingPurse)}</strong></div><div><span>DIFFICULTY</span><strong>{session.setup.difficulty}</strong></div><div><span>FORMAT</span><strong>{session.setup.format}</strong></div></div><div className="identity-divider" /><div className="eyebrow">RETAINED CORE</div><div className="core-list">{profile.retainedCore.map((player) => <span key={player}><Check size={13} /> {player}</span>)}</div></aside><div className="war-main"><div className="war-main-heading"><div><div className="eyebrow">SQUAD GAP ANALYSIS</div><h2>What must you solve?</h2></div><span className="analysis-status"><span className="pulse" /> {session.poolLabel.toUpperCase()}</span></div><div className="gap-grid">{Object.entries(roleLabels).map(([role, label]) => <button key={role} className={`gap-card ${selectedRole === role ? "selected" : ""}`} onClick={() => setSelectedRole(role)}><span className="gap-role">{role}</span><strong>{label}</strong><small>{profile.needs.includes(label) ? "Primary gap" : "Coverage review"}</small><div className="gap-bar"><i style={{ width: profile.needs.includes(label) ? "28%" : role === "BAT" ? "72%" : "51%" }} /></div><b>{profile.needs.includes(label) ? "CRITICAL" : "STABLE"}</b></button>)}</div><div className="target-planner"><div className="planner-head"><div><div className="eyebrow">TARGET BOARD</div><h2>Set your first two priorities</h2></div><span>{targets.length} / 2 MINIMUM</span></div><div className="target-board">{targets.length === 0 && <div className="empty-target"><Target size={22} /><strong>Your board is empty.</strong><small>Choose a gap, then add a target from the market.</small></div>}{targets.map((target) => { const player = sessionPlayers.find((item) => item.playerId === target.playerId); return player ? <div className="target-row" key={target.playerId}><PlayerPortrait player={player} size={36} className="target-avatar" /><div className="target-row-copy"><strong>{player.identity.shortName}</strong><small>{roleLabel(player.role.primary)} <span>•</span> Priority {target.priority}</small></div><b>{formatCr(target.maxBid)}</b><button className="remove-target" onClick={() => removeTarget(target.playerId)}><X size={14} /></button></div> : null; })}</div><button className="add-target-button" onClick={() => addTarget(selectedRole)}><Target size={15} /> ADD {roleLabels[selectedRole].toUpperCase()} TARGET</button></div></div></section><FlowFooter back="Franchise HQ" next={ready ? "Begin Live Auction" : "Add 2 Targets to Continue"} nextIcon={ready ? <Play size={15} /> : <LockKeyhole size={15} />} disabled={!ready} onBack={() => { rewindTo("FRANCHISE"); router.push("/franchise"); }} onNext={() => { markReady(); router.push("/auction"); }} /></main>;
}
