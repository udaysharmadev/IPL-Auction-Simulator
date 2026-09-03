"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { AuctionState } from "@/engine/auctionEngine";
import { audioEngine } from "@/lib/audioEngine";
import { FRANCHISES_2027, type FranchiseId } from "@/data/teams/franchises";
import { PLAYERS_2027 } from "@/data/players/2027";

const playerById = new Map(PLAYERS_2027.map((p) => [p.playerId, p]));
const teamById = new Map(FRANCHISES_2027.map((t) => [t.id, t]));

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function useAuctionImmersive(auction: AuctionState | null, enabled: boolean) {
  const [commentary, setCommentary] = useState("");
  const [auctioneerLine, setAuctioneerLine] = useState("");
  const lastPhaseRef = useRef<string>("");
  const lastBidRef = useRef<number>(0);
  const lastEventCountRef = useRef(0);
  const introPlayedRef = useRef(false);
  const busyRef = useRef(false);
  const currentLotRef = useRef<string>("");

  const runSequence = useCallback(async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try { await fn(); } finally { busyRef.current = false; }
  }, []);

  const getTeamName = useCallback((actor: string | undefined): string => {
    if (!actor) return "";
    if (actor === "YOU") {
      const t = teamById.get(auction?.userFranchiseId as FranchiseId);
      return t?.shortName ?? "Your table";
    }
    const t = teamById.get(actor as FranchiseId);
    return t?.shortName ?? actor;
  }, [auction?.userFranchiseId]);

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
    if (!enabled || !auction) return;
    audioEngine.startAmbience();
    return () => audioEngine.stopAmbience();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !auction) return;

    const phase = auction.phase;
    const prevPhase = lastPhaseRef.current;
    const lotKey = `${auction.currentIndex}:${auction.currentPlayerId}`;

    // ── GAME INTRO (first load only) ──────────────────────
    if (!introPlayedRef.current && phase === "PLAYER_PRESENTATION") {
      introPlayedRef.current = true;
      runSequence(async () => {
        setAuctioneerLine("Welcome to IPL 2027 Mega Auction!");
        await audioEngine.auctionIntro();
        await delay(800);
        audioEngine.crowdCheer();
        await delay(500);

        // Now announce the first player
        await announceNewPlayer(auction);
      });
      lastPhaseRef.current = phase;
      lastBidRef.current = auction.currentBid;
      lastEventCountRef.current = auction.events.length;
      currentLotRef.current = lotKey;
      return;
    }

    // ── NEW PLAYER ON THE BLOCK ───────────────────────────
    if (phase === "PLAYER_PRESENTATION" && prevPhase !== "PLAYER_PRESENTATION") {
      currentLotRef.current = lotKey;
      runSequence(async () => {
        await announceNewPlayer(auction);
      });
    }

    // ── BIDDING PHASE ─────────────────────────────────────
    if ((phase === "BIDDING" || phase === "FIRST_BID") && auction.events.length > lastEventCountRef.current) {
      const latestBidEvent = auction.events.filter((e) => e.type === "bid").at(-1);
      if (latestBidEvent) {
        const teamName = getTeamName(latestBidEvent.actor);
        const isUser = latestBidEvent.actor === "YOU";
        const bidCount = auction.events.filter((e) => e.type === "bid").length;

        if (isUser) {
          audioEngine.playBidConfirm();
          setAuctioneerLine(`You bid ₹${auction.currentBid} crore!`);
        } else if (teamName) {
          audioEngine.playBidConfirm();
          if (bidCount === 1) {
            setAuctioneerLine(`${teamName} opens the bidding at ₹${auction.currentBid} crore!`);
            audioEngine.crowdMurmur();
          } else if (bidCount > 3) {
            setAuctioneerLine(`${teamName} jumps in! ₹${auction.currentBid} crore!`);
            audioEngine.crowdMurmur();
          } else {
            setAuctioneerLine(`${teamName} counters at ₹${auction.currentBid} crore!`);
          }
        }

        const player = playerById.get(auction.currentPlayerId);

        // Commentator reacts to big bids or two-team battle
        runSequence(async () => {
          if (player && auction.currentBid >= player.valuation.fairValue && lastBidRef.current < player.valuation.fairValue) {
            audioEngine.crowdGasp();
            await delay(400);
            await audioEngine.commentatorSay(
              `${player.identity.shortName} ki fair value cross ho gayi hai! Ab bohot interesting ho raha hai!`
            );
          }

          if (bidCount > 2 && bidCount % 3 === 0) {
            const actors = [...new Set(auction.events.filter((e) => e.type === "bid").map((e) => e.actor))];
            if (actors.length === 2) {
              const t1 = getTeamName(actors[0]);
              const t2 = getTeamName(actors[1]);
              await audioEngine.commentatorBiddingWar(t1, t2, auction.currentBid);
            }
          }
        });
      }
    }

    // ── FINAL CALL ────────────────────────────────────────
    if (phase === "FINAL_CALL" && prevPhase !== "FINAL_CALL") {
      runSequence(async () => {
        audioEngine.playDramaticRumble();
        await delay(600);
        setAuctioneerLine(`Final call at ₹${auction.currentBid} crore...`);

        await audioEngine.announceGoingOnce(auction.currentBid);
        audioEngine.playClockTick();
        await audioEngine.announceGoingTwice(auction.currentBid);
        audioEngine.playClockTick();
      });
    }

    // ── SOLD ──────────────────────────────────────────────
    if (phase === "SOLD" && prevPhase !== "SOLD") {
      const player = playerById.get(auction.currentPlayerId);
      const team = auction.highestBidder
        ? teamById.get((auction.highestBidder === "YOU" ? auction.userFranchiseId : auction.highestBidder) as FranchiseId)
        : undefined;

      if (player && team) {
        runSequence(async () => {
          await delay(300);
          await audioEngine.announceSold(player.identity.shortName, team.shortName, auction.currentBid);
          audioEngine.playSoldFanfare();
          audioEngine.crowdCheer();
          setCommentary(`SOLD! ${player.identity.shortName} goes to ${team.shortName} for ₹${auction.currentBid} crore!`);

          await delay(1200);
          await audioEngine.commentatorSold(player.identity.shortName, team.shortName, auction.currentBid);
        });
      }
    }

    // ── PASSED ────────────────────────────────────────────
    if (phase === "PASSED" && prevPhase !== "PASSED") {
      const player = playerById.get(auction.currentPlayerId);
      if (player) {
        runSequence(async () => {
          audioEngine.crowdMurmur();
          await delay(400);
          setAuctioneerLine(`${player.identity.shortName} goes unsold.`);
          await audioEngine.announcePassed(player.identity.shortName);
          await delay(600);
          await audioEngine.commentatorUnsold(player.identity.shortName);
        });
      }
    }

    lastPhaseRef.current = phase;
    lastBidRef.current = auction.currentBid;
    lastEventCountRef.current = auction.events.length;
  }, [enabled, auction?.phase, auction?.currentBid, auction?.events.length, auction?.currentIndex, runSequence, getTeamName]);

  async function announceNewPlayer(auction: AuctionState) {
    const player = playerById.get(auction.currentPlayerId);
    if (!player) return;

    audioEngine.playNewPlayerAlert();
    await delay(600);

    // English auctioneer introduces the player
    const nationality = player.identity.nationality;
    const roleMap: Record<string, string> = { BAT: "batsman", BOWL: "bowler", AR: "all-rounder", WK: "wicketkeeper" };
    const roleLabel = roleMap[player.role.primary] || player.role.primary;
    const basePrice = player.auctionData.basePrice ?? 1;

    setAuctioneerLine(`Up next: ${player.identity.shortName}`);
    await audioEngine.auctioneerSay(
      `Ladies and gentlemen, the next player on the block is ${nationality}'s finest ${roleLabel} — ${player.identity.name}!`
    );
    await delay(300);
    await audioEngine.auctioneerSay(`Base price set at ${basePrice} crore.`);
    await delay(200);

    // Hindi commentator adds context
    const statsParts: string[] = [];
    if (player.realData.runs > 0) statsParts.push(`${player.realData.runs} runs in IPL`);
    if (player.realData.wickets > 0) statsParts.push(`${player.realData.wickets} wickets`);
    if (player.realData.strikeRate) statsParts.push(`strike rate ${player.realData.strikeRate}`);
    if (player.realData.economy) statsParts.push(`economy ${player.realData.economy}`);
    const stats = statsParts.length > 0 ? statsParts.join(", ") : `Overall rating ${player.simulationData.overall}`;

    await audioEngine.commentatorPlayerIntro(
      player.identity.shortName,
      player.role.primary,
      stats
    );

    setCommentary(
      `${player.identity.name} (${roleLabel}) from ${nationality} • Base: ₹${basePrice} Cr • Overall: ${player.simulationData.overall}`
    );
    setAuctioneerLine(`₹${basePrice} crore base price. Who wants to open the bidding?`);
  }

  const toggleAudio = useCallback(() => {
    const next = !audioEngine.isEnabled();
    audioEngine.setEnabled(next);
    if (next) audioEngine.startAmbience();
    else audioEngine.stopAmbience();
  }, []);

  return { commentary, auctioneerLine, toggleAudio };
}
