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
  const voiceQueueRef = useRef<Array<() => Promise<void>>>([]);
  const processingQueueRef = useRef(false);

  const enqueueVoice = useCallback((fn: () => Promise<void>) => {
    voiceQueueRef.current.push(fn);
    if (!processingQueueRef.current) {
      processingQueueRef.current = true;
      (async () => {
        while (voiceQueueRef.current.length > 0) {
          const task = voiceQueueRef.current.shift()!;
          await task();
        }
        processingQueueRef.current = false;
      })();
    }
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

    // ── GAME INTRO (first load only) ──────────────────────
    if (!introPlayedRef.current && phase === "PLAYER_PRESENTATION") {
      introPlayedRef.current = true;
      enqueueVoice(async () => {
        setAuctioneerLine("Welcome to IPL 2027 Mega Auction!");
        await audioEngine.auctionIntro();
        await wait(500);
        audioEngine.crowdCheer();
        await wait(400);
        await announcePlayer(auction);
      });
      lastPhaseRef.current = phase;
      lastBidRef.current = auction.currentBid;
      lastEventCountRef.current = auction.events.length;
      return;
    }

    // ── NEW PLAYER ON THE BLOCK ───────────────────────────
    if (phase === "PLAYER_PRESENTATION" && prevPhase !== "PLAYER_PRESENTATION") {
      enqueueVoice(async () => {
        await wait(300);
        await announcePlayer(auction);
      });
    }

    // ── BIDDING PHASE ─────────────────────────────────────
    if ((phase === "BIDDING" || phase === "FIRST_BID") && auction.events.length > lastEventCountRef.current) {
      const latestBidEvent = auction.events.filter((e) => e.type === "bid").at(-1);
      if (latestBidEvent) {
        const teamName = getTeamShortName(latestBidEvent.actor, auction.userFranchiseId);
        const isUser = latestBidEvent.actor === "YOU";

        // Set visual text
        if (isUser) {
          setAuctioneerLine(`You bid ${formatCr(auction.currentBid)}!`);
        } else {
          setAuctioneerLine(`${teamName} at ${formatCr(auction.currentBid)}!`);
        }

        // Voice for every bid
        enqueueVoice(async () => {
          audioEngine.playBidConfirm();
          if (isUser) {
            // User bid — no voice (they know what they did)
          } else if (bidCount === 1) {
            await audioEngine.announceOpenBid(teamName, auction.currentBid);
          } else {
            await audioEngine.announceBid(teamName, auction.currentBid);
          }
        });

        // Commentary for big moments
        const player = playerById.get(auction.currentPlayerId);
        if (player) {
          // Fair value crossed
          if (auction.currentBid >= player.valuation.fairValue && lastBidRef.current < player.valuation.fairValue) {
            audioEngine.crowdGasp();
            enqueueVoice(async () => {
              await wait(200);
              await audioEngine.commentatorSay("Fair value cross ho gayi! Bohot interesting ho raha hai!");
            });
          }

          // Two-team battle
          if (bidCount > 2 && bidCount % 4 === 0) {
            const actors = [...new Set(auction.events.filter((e) => e.type === "bid").map((e) => e.actor))];
            if (actors.length === 2) {
              const t1 = getTeamShortName(actors[0], auction.userFranchiseId);
              const t2 = getTeamShortName(actors[1], auction.userFranchiseId);
              enqueueVoice(async () => {
                await audioEngine.commentatorBidWar(t1, t2);
              });
            }
          }

          // Budget warning
          if (auction.aiTrace && bidCount > 3 && bidCount % 5 === 0) {
            const traceTeam = auction.aiTrace.team;
            enqueueVoice(async () => {
              await audioEngine.commentatorBudgetAlert(traceTeam, auction.aiTrace?.maxBid ?? 0);
            });
          }
        }
      }
    }

    // ── FINAL CALL ────────────────────────────────────────
    if (phase === "FINAL_CALL" && prevPhase !== "FINAL_CALL") {
      enqueueVoice(async () => {
        audioEngine.playDramaticRumble();
        await wait(500);
        setAuctioneerLine(`Final call at ${formatCr(auction.currentBid)}...`);
        await audioEngine.announceGoingOnce(auction.currentBid);
        audioEngine.playClockTick();
        await audioEngine.announceGoingTwice(auction.currentBid);
        audioEngine.playClockTick();
        await wait(300);
        busyRef.current = false;
        onCountdownComplete?.();
      });
    }

    // ── SOLD ──────────────────────────────────────────────
    if (phase === "SOLD" && prevPhase !== "SOLD") {
      const player = playerById.get(auction.currentPlayerId);
      const team = auction.highestBidder
        ? teamById.get((auction.highestBidder === "YOU" ? auction.userFranchiseId : auction.highestBidder) as FranchiseId)
        : undefined;

      if (player && team) {
        enqueueVoice(async () => {
          await audioEngine.announceSold(player.identity.shortName, team.shortName, auction.currentBid);
          audioEngine.playSoldFanfare();
          audioEngine.crowdCheer();
          setCommentary(`SOLD! ${player.identity.shortName} → ${team.shortName} for ${formatCr(auction.currentBid)}!`);
          await wait(1000);
          await audioEngine.commentatorSoldReaction(player.identity.shortName, team.shortName, auction.currentBid);
        });
      }
    }

    // ── PASSED ────────────────────────────────────────────
    if (phase === "PASSED" && prevPhase !== "PASSED") {
      const player = playerById.get(auction.currentPlayerId);
      if (player) {
        enqueueVoice(async () => {
          audioEngine.crowdMurmur();
          await wait(300);
          setAuctioneerLine(`${player.identity.shortName} goes unsold.`);
          await audioEngine.announcePassed(player.identity.shortName);
          await wait(500);
          await audioEngine.commentatorUnsoldReaction(player.identity.shortName);
        });
      }
    }

    lastPhaseRef.current = phase;
    lastBidRef.current = auction.currentBid;
    lastEventCountRef.current = auction.events.length;
  }, [enabled, auction?.phase, auction?.currentBid, auction?.events.length, auction?.currentIndex, enqueueVoice, onCountdownComplete]);

  async function announcePlayer(auction: AuctionState) {
    const player = playerById.get(auction.currentPlayerId);
    if (!player) return;

    audioEngine.playNewPlayerAlert();
    await wait(400);

    const nationality = player.identity.nationality;
    const roleMap: Record<string, string> = { BAT: "batsman", BOWL: "bowler", AR: "all-rounder", WK: "wicketkeeper" };
    const roleLabel = roleMap[player.role.primary] || player.role.primary;
    const basePrice = player.auctionData.basePrice ?? 1;

    setAuctioneerLine(`${player.identity.shortName} on the block`);
    await audioEngine.announcePlayer(player.identity.shortName, nationality, player.role.primary, basePrice);

    // Hindi commentator adds context
    const statsParts: string[] = [];
    if (player.realData.runs > 0) statsParts.push(`${player.realData.runs} runs in IPL`);
    if (player.realData.wickets > 0) statsParts.push(`${player.realData.wickets} wickets`);
    if (player.realData.strikeRate) statsParts.push(`strike rate ${player.realData.strikeRate}`);
    const stats = statsParts.length > 0 ? statsParts.join(", ") : `Overall ${player.simulationData.overall}`;
    await audioEngine.commentatorPlayerContext(player.identity.shortName, player.role.primary, stats);

    setCommentary(`${player.identity.name} (${roleLabel}) • ${nationality} • Base: ${formatCr(basePrice)} • Overall: ${player.simulationData.overall}`);
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

function formatCr(value: number): string {
  return `₹${value} Cr`;
}
