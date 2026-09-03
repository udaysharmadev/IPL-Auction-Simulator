import { FRANCHISES, PLAYERS, type Player, type Role } from "@/data/mockData";
import { isUserBidder, type AuctionEvent, type AuctionState } from "@/engine/auctionEngine";

export type ScarcitySnapshot = Record<Role, { remaining: number; label: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }>;
export type AuctionWarning = { level: "INFO" | "WARNING" | "CRITICAL"; title: string; detail: string };
export type CameraShot = "WIDE_ROOM" | "PLAYER_REVEAL" | "BID_FOCUS" | "RIVAL_REACTION" | "FINAL_CALL" | "HAMMER_SOLD";

const labels: Record<Role, string> = { BAT: "Batters", BOWL: "Bowlers", AR: "All-rounders", WK: "Wicketkeepers" };

export function scarcityFor(state: AuctionState): ScarcitySnapshot {
  const activePlayers = playersForState(state);
  const remainingIds = new Set(state.order.slice(state.currentIndex));
  const remaining = activePlayers.filter((player) => remainingIds.has(player.playerId)).reduce((counts, player) => ({ ...counts, [player.role.primary]: counts[player.role.primary] + 1 }), { BAT: 0, BOWL: 0, AR: 0, WK: 0 } as Record<Role, number>);
  return (Object.keys(labels) as Role[]).reduce((snapshot, role) => {
    const count = remaining[role];
    snapshot[role] = { remaining: count, label: labels[role], severity: count <= 1 ? "CRITICAL" : count <= 3 ? "HIGH" : count <= 6 ? "MEDIUM" : "LOW" };
    return snapshot;
  }, {} as ScarcitySnapshot);
}

export function warningsFor(state: AuctionState, player: Player): AuctionWarning[] {
  const warnings: AuctionWarning[] = [];
  const scarcity = scarcityFor(state)[player.role.primary];
  if (scarcity.severity === "CRITICAL") warnings.push({ level: "CRITICAL", title: `Only ${scarcity.remaining} viable ${scarcity.label.toLowerCase().slice(0, -1)} remains`, detail: "Alternatives are disappearing. Walking away may leave a structural squad gap." });
  if (state.userMaxBid && state.currentBid >= state.userMaxBid) warnings.push({ level: "WARNING", title: "Above your planned maximum", detail: `Your ceiling is ₹${state.userMaxBid.toFixed(2)} Cr. Smart Max can protect the rest of your squad.` });
  if (state.userBudget - state.currentBid < state.ruleSet.auction.startingPurse * 0.2) warnings.push({ level: "WARNING", title: "Reserve budget is tightening", detail: "A premium purchase now may reduce your ability to complete the minimum squad." });
  if (player.simulationData.injuryRisk > 25) warnings.push({ level: "INFO", title: "Availability watch", detail: "Projected injury risk is elevated. This is simulation-generated information." });
  return warnings;
}

export function shotFor(state: AuctionState): CameraShot {
  if (state.phase === "FINAL_CALL") return "FINAL_CALL";
  if (state.phase === "SOLD") return "HAMMER_SOLD";
  if (state.currentBid === 0) return "PLAYER_REVEAL";
  if (state.highestBidder && isUserBidder(state, state.highestBidder)) return "BID_FOCUS";
  return "RIVAL_REACTION";
}

export function aiTeamName(shortName: string) { return FRANCHISES.find((team) => team.shortName === shortName)?.name ?? shortName; }

export function auctionMoments(state: AuctionState) {
  const activePlayers = playersForState(state);
  const playerById = new Map(activePlayers.map((player) => [player.playerId, player]));
  const sold = state.events.filter((event) => event.type === "sold");
  const moments: { type: string; title: string; detail: string; playerId?: string }[] = [];
  sold.forEach((event) => {
    const player = event.playerId ? playerById.get(event.playerId) : undefined;
    if (!player || !event.price) return;
    if (event.price <= player.valuation.fairValue * 0.72) moments.push({ type: "STEAL", title: "Steal of the auction", detail: `${player.identity.shortName} landed well below the model fair value.`, playerId: player.playerId });
    if (event.price >= player.valuation.fairValue * 1.32) moments.push({ type: "OVERPAY", title: "Biggest overpay", detail: `${player.identity.shortName} went through a market premium.`, playerId: player.playerId });
  });
  const bidsByPlayer = new Map<string, number>();
  state.events.forEach((event) => { if (event.playerId && event.type === "bid") bidsByPlayer.set(event.playerId, (bidsByPlayer.get(event.playerId) ?? 0) + 1); });
  const longest = [...bidsByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];
  if (longest && longest[1] >= 4) { const player = playerById.get(longest[0]); if (player) moments.push({ type: "BID_WAR", title: "Longest bid war", detail: `${longest[1]} decisions kept ${player.identity.shortName} in play.`, playerId: player.playerId }); }
  return moments.slice(-5).reverse();
}

export function bidCountForCurrent(state: AuctionState) { return state.events.filter((event: AuctionEvent) => event.playerId === state.currentPlayerId && event.type === "bid").length; }

/** Resolve the immutable player pool carried by an auction save. Legacy saves
 * do not have this field and intentionally fall back to the full dataset. */
export function playersForState(state: AuctionState): Player[] {
  const ids = state.playerPoolIds ?? state.order;
  if (!ids?.length) return PLAYERS;
  const byId = new Map(PLAYERS.map((player) => [player.playerId, player]));
  const resolved = ids.map((id) => byId.get(id)).filter((player): player is Player => Boolean(player));
  return resolved.length > 0 ? resolved : PLAYERS;
}
