"use client";

import { useEffect } from "react";
import type { AuctionState } from "@/engine/auctionEngine";
import { isUserBidder } from "@/engine/auctionEngine";

type KeyboardActions = {
  bid: (increment?: number) => void;
  pass: () => void;
  advance: () => void;
  toggleSound: () => void;
};

export function useAuctionKeyboard(
  auction: AuctionState | null,
  actions: KeyboardActions
) {
  useEffect(() => {
    if (!auction) return;

    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      const canBid =
        (auction.phase === "BIDDING" || auction.phase === "FIRST_BID" || auction.phase === "FINAL_CALL") &&
        !isUserBidder(auction, auction.highestBidder ?? "") &&
        auction.bidderStates?.[auction.userFranchiseId]?.status !== "FOLDED";

      switch (event.key.toLowerCase()) {
        case "b":
          event.preventDefault();
          if (canBid) actions.bid();
          break;
        case "p":
          event.preventDefault();
          if (canBid || auction.phase === "FIRST_BID" || auction.phase === "BIDDING" || auction.phase === "FINAL_CALL") {
            actions.pass();
          }
          break;
        case " ":
          event.preventDefault();
          actions.advance();
          break;
        case "s":
          event.preventDefault();
          actions.toggleSound();
          break;
        case "1":
        case "2":
        case "3": {
          const incrementIndex = Number(event.key) - 1;
          if (canBid && auction.currentBid > 0) {
            const increments = [...new Set([0.25, 0.5, 1])];
            const increment = increments[incrementIndex];
            if (increment !== undefined) {
              event.preventDefault();
              actions.bid(increment);
            }
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [auction, actions]);
}
