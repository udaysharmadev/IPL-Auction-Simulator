"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { AuctionState } from "@/engine/auctionEngine";
import { audioEngine } from "@/lib/audioEngine";
import { FRANCHISES_2027, type FranchiseId } from "@/data/teams/franchises";
import { PLAYERS_2027 } from "@/data/players/2027";

const playerById = new Map(PLAYERS_2027.map((p) => [p.playerId, p]));
const teamById = new Map(FRANCHISES_2027.map((t) => [t.id, t]));

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getTeamShortName(actor: string | undefined, userFranchiseId: string): string {
  if (!actor) return "";
  if (actor === "YOU") return teamById.get(userFranchiseId as FranchiseId)?.shortName ?? "Your table";
  return teamById.get(actor as FranchiseId)?.shortName ?? actor;
}

function formatCr(value: number): string {
  return `₹${value} Cr`;
}

export function useAuctionImmersive(
  auction: AuctionState | null,
  enabled: boolean,
  onCountdownComplete?: () => void
) {
  const [commentary, setCommentary] = useState("");
  const [auctioneerLine, setAuctioneerLine] = useState("");
  const lastPhaseRef = useRef<string>("");
  const lastBidRef = useRef<number>(0);
  const lastEventCountRef = useRef(0);
  const introPlayedRef = useRef(false);
  const busyRef = useRef(false);
  const speakingRef = useRef(false);
  const pendingBidVoiceRef = useRef<(() => Promise<void>) | null>(null);

  // Cancel any pending bid voice when a new bid comes in
  const scheduleBidVoice = useCallback((fn: () => Promise<void>) => {
    pendingBidVoiceRef.current = fn;
    if (!speakingRef.current) {
      runPendingBidVoice();
    }
  }, []);

  const runPendingBidVoice = useCallback(async () => {
    const task = pendingBidVoiceRef.current;
    if (!task) return;
    pendingBidVoiceRef.current = null;
    speakingRef.current = true;
    try { await task(); } finally { speakingRef.current = false; }
  }, []);

  useEffect(() => {
    if (!enabled || !auction) return;
    audioEngine.init();
    audioEngine.setEnabled(true);
  }, [enabled, auction]);

  useEffect(() => {
    if (!enabled || !auction) return;
    audioEngine.setTension(auction.tension);
  }, [enabled, auction?.tension]);

  useEffect(() => {
    if (!enabled) return;
    audioEngine.startAmbience();
    return () => audioEngine.stopAmbience();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !auction) return;

    const phase = auction.phase;
    const prevPhase = lastPhaseRef.current;
    const bidCount = auction.events.filter((e) => e.type === "bid").length;

    // ── GAME INTRO ────────────────────────────────────────
    if (!introPlayedRef.current && phase === "PLAYER_PRESENTATION") {
      introPlayedRef.current = true;
      speakingRef.current = true;
      (async () => {
        setAuctioneerLine("Welcome to IPL 2027 Mega Auction!");
        await audioEngine.auctionIntro();
        await wait(300);
        audioEngine.crowdCheer();
        await wait(300);
        await announcePlayer(auction);
        speakingRef.current = false;
      })();
      lastPhaseRef.current = phase;
      lastBidRef.current = auction.currentBid;
      lastEventCountRef.current = auction.events.length;
      return;
    }

    // ── NEW PLAYER ────────────────────────────────────────
    if (phase === "PLAYER_PRESENTATION" && prevPhase !== "PLAYER_PRESENTATION") {
      speakingRef.current = true;
      (async () => {
        await wait(200);
        await announcePlayer(auction);
        speakingRef.current = false;
      })();
    }

    // ── BIDDING ───────────────────────────────────────────
    if ((phase === "BIDDING" || phase === "FIRST_BID") && auction.events.length > lastEventCountRef.current) {
      const latestBidEvent = auction.events.filter((e) => e.type === "bid").at(-1);
      if (latestBidEvent) {
        const teamName = getTeamShortName(latestBidEvent.actor, auction.userFranchiseId);
        const isUser = latestBidEvent.actor === "YOU";

        // Visual text — instant
        if (isUser) {
          setAuctioneerLine(`You bid ${formatCr(auction.currentBid)}!`);
        } else {
          setAuctioneerLine(`${teamName} at ${formatCr(auction.currentBid)}!`);
        }

        // Voice — short, punchy, replaces any pending bid voice
        if (!isUser) {
          scheduleBidVoice(async () => {
            await wait(150);
            audioEngine.playBidConfirm();
            if (bidCount === 1) {
              await audioEngine.announceOpenBid(teamName, auction.currentBid);
            } else {
              await audioEngine.announceBid(teamName, auction.currentBid);
            }
          });
        } else {
          // User bid — just confirm sound, no voice
          audioEngine.playBidConfirm();
        }

        // Fair value crossed — crowd gasp + short commentary
        const player = playerById.get(auction.currentPlayerId);
        if (player && auction.currentBid >= player.valuation.fairValue && lastBidRef.current < player.valuation.fairValue) {
          audioEngine.crowdGasp();
        }
      }
    }

    // ── FINAL CALL ────────────────────────────────────────
    if (phase === "FINAL_CALL" && prevPhase !== "FINAL_CALL") {
      speakingRef.current = true;
      (async () => {
        audioEngine.playDramaticRumble();
        await wait(400);
        setAuctioneerLine(`Final call at ${formatCr(auction.currentBid)}...`);
        await audioEngine.announceGoingOnce(auction.currentBid);
        audioEngine.playClockTick();
        await audioEngine.announceGoingTwice(auction.currentBid);
        audioEngine.playClockTick();
        await wait(200);
        speakingRef.current = false;
        busyRef.current = false;
        onCountdownComplete?.();
      })();
    }

    // ── SOLD ──────────────────────────────────────────────
    if (phase === "SOLD" && prevPhase !== "SOLD") {
      const player = playerById.get(auction.currentPlayerId);
      const team = auction.highestBidder
        ? teamById.get((auction.highestBidder === "YOU" ? auction.userFranchiseId : auction.highestBidder) as FranchiseId)
        : undefined;

      if (player && team) {
        speakingRef.current = true;
        (async () => {
          await audioEngine.announceSold(player.identity.shortName, team.shortName, auction.currentBid);
          audioEngine.playSoldFanfare();
          audioEngine.crowdCheer();
          setCommentary(`SOLD! ${player.identity.shortName} → ${team.shortName} for ${formatCr(auction.currentBid)}!`);
          speakingRef.current = false;
        })();
      }
    }

    // ── PASSED ────────────────────────────────────────────
    if (phase === "PASSED" && prevPhase !== "PASSED") {
      const player = playerById.get(auction.currentPlayerId);
      if (player) {
        speakingRef.current = true;
        (async () => {
          audioEngine.crowdMurmur();
          await wait(200);
          setAuctioneerLine(`${player.identity.shortName} goes unsold.`);
          await audioEngine.announcePassed(player.identity.shortName);
          speakingRef.current = false;
        })();
      }
    }

    lastPhaseRef.current = phase;
    lastBidRef.current = auction.currentBid;
    lastEventCountRef.current = auction.events.length;
  }, [enabled, auction?.phase, auction?.currentBid, auction?.events.length, auction?.currentIndex, scheduleBidVoice, onCountdownComplete]);

  async function announcePlayer(auction: AuctionState) {
    const player = playerById.get(auction.currentPlayerId);
    if (!player) return;

    audioEngine.playNewPlayerAlert();
    await wait(300);

    const nationality = player.identity.nationality;
    const basePrice = player.auctionData.basePrice ?? 1;

    setAuctioneerLine(`${player.identity.shortName} on the block`);
    await audioEngine.announcePlayer(player.identity.shortName, nationality, player.role.primary, basePrice);

    setCommentary(`${player.identity.name} • ${nationality} • Base: ${formatCr(basePrice)} • Overall: ${player.simulationData.overall}`);
    setAuctioneerLine(`${formatCr(basePrice)} base. Who opens?`);
  }

  const toggleAudio = useCallback(() => {
    const next = !audioEngine.isEnabled();
    audioEngine.setEnabled(next);
    if (next) audioEngine.startAmbience();
    else audioEngine.stopAmbience();
  }, []);

  return { commentary, auctioneerLine, toggleAudio };
}
