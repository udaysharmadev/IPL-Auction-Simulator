"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { AuctionState } from "@/engine/auctionEngine";
import { isUserBidder } from "@/engine/auctionEngine";
import { audioEngine } from "@/lib/audioEngine";
import { generateCommentary, generateAuctioneerLine, type CommentaryContext } from "@/lib/commentary";
import { FRANCHISES_2027, type FranchiseId } from "@/data/teams/franchises";
import { PLAYERS_2027 } from "@/data/players/2027";

const playerById = new Map(PLAYERS_2027.map((p) => [p.playerId, p]));
const teamById = new Map(FRANCHISES_2027.map((t) => [t.id, t]));

export function useAuctionImmersive(auction: AuctionState | null, enabled: boolean) {
  const [commentary, setCommentary] = useState("");
  const [auctioneerLine, setAuctioneerLine] = useState("");
  const lastPhaseRef = useRef<string>("");
  const lastBidRef = useRef<number>(0);
  const lastEventCountRef = useRef(0);
  const countdownRunningRef = useRef(false);

  const buildContext = useCallback((): CommentaryContext | null => {
    if (!auction) return null;
    const player = playerById.get(auction.currentPlayerId);
    if (!player) return null;
    const team = auction.highestBidder ? teamById.get((auction.highestBidder === "YOU" ? auction.userFranchiseId : auction.highestBidder) as FranchiseId) : undefined;
    return {
      playerName: player.identity.shortName,
      playerRole: player.role.primary,
      nationality: player.identity.nationality,
      category: auction.auctionCategory,
      currentBid: auction.currentBid,
      fairValue: player.valuation.fairValue,
      teamName: team?.shortName,
      remainingBudget: auction.userBudget,
      maxBudget: auction.ruleSet.auction.startingPurse,
      squadSize: auction.userSquad.length,
      maxSquad: auction.ruleSet.auction.maxSquadSize,
      overseasCount: auction.userSquad.filter((id) => playerById.get(id)?.auctionData.nationalityStatus === "OVERSEAS").length,
      maxOverseas: auction.ruleSet.auction.maxOverseas,
      tension: auction.tension,
      bidCount: auction.events.filter((e) => e.type === "bid").length,
      phase: auction.phase === "PLAYER_PRESENTATION" ? "INTRO" : auction.phase === "FIRST_BID" || auction.phase === "BIDDING" ? "BID" : auction.phase === "FINAL_CALL" ? "FINAL_CALL" : auction.phase === "SOLD" ? "SOLD" : auction.phase === "PASSED" ? "PASSED" : "SQUAD"
    };
  }, [auction]);

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
    const ctx = buildContext();
    if (!ctx) return;

    const phase = auction.phase;
    const prevPhase = lastPhaseRef.current;

    if (phase === "PLAYER_PRESENTATION" && prevPhase !== "PLAYER_PRESENTATION") {
      const player = playerById.get(auction.currentPlayerId);
      if (player) {
        audioEngine.announcePlayer(player.identity.shortName, player.role.primary);
        const intro = generateCommentary({ ...ctx, phase: "INTRO" });
        setCommentary(intro);
        setAuctioneerLine(generateAuctioneerLine({ ...ctx, phase: "INTRO" }));
      }
    }

    if (phase === "BIDDING" || phase === "FIRST_BID") {
      const latestBidEvent = auction.events.filter((e) => e.type === "bid").at(-1);
      if (latestBidEvent && auction.events.length > lastEventCountRef.current) {
        if (latestBidEvent.actor === "YOU") {
          audioEngine.playBidConfirm();
          audioEngine.announceBid(auction.currentBid);
        } else if (latestBidEvent.actor) {
          const team = teamById.get(latestBidEvent.actor as FranchiseId);
          if (team) {
            audioEngine.announceRivalBid(team.shortName, auction.currentBid);
            audioEngine.playBidConfirm();
          }
        }
        const bidCommentary = generateCommentary({ ...ctx, phase: "BID" });
        setCommentary(bidCommentary);
        setAuctioneerLine(generateAuctioneerLine({ ...ctx, phase: "BID" }));
      }
      if (auction.currentBid > 0 && auction.currentBid >= (playerById.get(auction.currentPlayerId)?.valuation.fairValue ?? 0) && lastBidRef.current < (playerById.get(auction.currentPlayerId)?.valuation.fairValue ?? 0)) {
        audioEngine.crowdGasp();
      }
    }

    if (phase === "FINAL_CALL" && prevPhase !== "FINAL_CALL" && !countdownRunningRef.current) {
      countdownRunningRef.current = true;
      audioEngine.playClockTick();
      setCommentary(generateCommentary({ ...ctx, phase: "FINAL_CALL" }));
      setAuctioneerLine(generateAuctioneerLine({ ...ctx, phase: "FINAL_CALL" }));

      (async () => {
        await audioEngine.announceCountdown();
        countdownRunningRef.current = false;
      })();
    }

    if (phase === "SOLD" && prevPhase !== "SOLD") {
      countdownRunningRef.current = false;
      const player = playerById.get(auction.currentPlayerId);
      const team = teamById.get((auction.highestBidder === "YOU" ? auction.userFranchiseId : (auction.highestBidder ?? "")) as FranchiseId);
      if (player && team) {
        audioEngine.playSoldFanfare();
        audioEngine.crowdCheer();
        audioEngine.announceSold(player.identity.shortName, team.shortName, auction.currentBid);
      }
      setCommentary(generateCommentary({ ...ctx, phase: "SOLD" }));
      setAuctioneerLine(generateAuctioneerLine({ ...ctx, phase: "SOLD" }));
    }

    if (phase === "PASSED" && prevPhase !== "PASSED") {
      countdownRunningRef.current = false;
      const player = playerById.get(auction.currentPlayerId);
      if (player) {
        audioEngine.crowdMurmur();
        audioEngine.announcePassed(player.identity.shortName);
      }
      setCommentary(generateCommentary({ ...ctx, phase: "PASSED" }));
      setAuctioneerLine(generateAuctioneerLine({ ...ctx, phase: "PASSED" }));
    }

    lastPhaseRef.current = phase;
    lastBidRef.current = auction.currentBid;
    lastEventCountRef.current = auction.events.length;
  }, [enabled, auction?.phase, auction?.currentBid, auction?.events.length, auction?.currentIndex, buildContext]);

  const toggleAudio = useCallback(() => {
    const next = !audioEngine.isEnabled();
    audioEngine.setEnabled(next);
    if (next) audioEngine.startAmbience();
    else audioEngine.stopAmbience();
  }, []);

  return { commentary, auctioneerLine, toggleAudio };
}
