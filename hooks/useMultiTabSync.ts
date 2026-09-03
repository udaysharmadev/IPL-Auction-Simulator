"use client";

import { useEffect, useRef } from "react";

const CHANNEL_NAME = "ipl-auction-sync";

type SyncMessage = {
  type: "AUCTION_UPDATE";
  payload: {
    franchiseId: string;
    seed: string;
    timestamp: number;
  };
};

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return channel;
}

export function useMultiTabSync(
  franchiseId: string,
  seed: string,
  onSyncReceived: () => void
) {
  const lastSentRef = useRef(0);

  useEffect(() => {
    const ch = getChannel();
    if (!ch) return;

    const handler = (event: MessageEvent<SyncMessage>) => {
      const data = event.data;
      if (data.type === "AUCTION_UPDATE" && data.payload.timestamp > lastSentRef.current) {
        onSyncReceived();
      }
    };

    ch.addEventListener("message", handler);
    return () => ch.removeEventListener("message", handler);
  }, [onSyncReceived]);

  const broadcastUpdate = () => {
    const ch = getChannel();
    if (!ch) return;
    const now = Date.now();
    lastSentRef.current = now;
    ch.postMessage({
      type: "AUCTION_UPDATE",
      payload: { franchiseId, seed, timestamp: now }
    } satisfies SyncMessage);
  };

  return { broadcastUpdate };
}
