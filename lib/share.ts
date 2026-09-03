import type { AuctionState } from "@/engine/auctionEngine";
import { gradeAuction } from "@/engine/auctionEngine";
import { PLAYERS_2027 } from "@/data/players/2027";
import { FRANCHISES_2027 } from "@/data/teams/franchises";

const formatCr = (value: number) => `₹${value.toFixed(value % 1 === 0 ? 0 : 2)} Cr`;
const playerById = new Map(PLAYERS_2027.map((p) => [p.playerId, p]));

export type AuctionResult = {
  franchise: string;
  grade: string;
  quality: number;
  coverage: number;
  efficiency: number;
  purse: number;
  spent: number;
  squad: { name: string; role: string; price: number }[];
  moments: { type: string; title: string; detail: string }[];
};

export function buildAuctionResult(state: AuctionState): AuctionResult {
  const report = gradeAuction(state);
  const team = FRANCHISES_2027.find((f) => f.id === state.userFranchiseId);
  const squad = state.userSquad.map((id) => {
    const player = playerById.get(id);
    const event = state.events.find((e) => e.playerId === id && e.type === "sold");
    return {
      name: player?.identity.shortName ?? id,
      role: player?.role.primary ?? "UNK",
      price: event?.price ?? 0
    };
  });
  const spent = state.userSquad.reduce((sum, id) => {
    const event = state.events.find((e) => e.playerId === id && e.type === "sold");
    return sum + (event?.price ?? 0);
  }, 0);
  return {
    franchise: team?.name ?? state.userFranchiseId,
    grade: report.grade,
    quality: report.quality,
    coverage: report.coverage,
    efficiency: report.efficiency,
    purse: state.ruleSet.auction.startingPurse,
    spent,
    squad,
    moments: []
  };
}

export function formatSquadReport(result: AuctionResult): string {
  const lines: string[] = [];
  lines.push(`${result.franchise} — Auction Report`);
  lines.push(`Grade: ${result.grade}`);
  lines.push(`Quality: ${result.quality} | Coverage: ${result.coverage} | Efficiency: ${result.efficiency}`);
  lines.push(`Purse: ${formatCr(result.purse)} | Spent: ${formatCr(result.spent)} | Remaining: ${formatCr(result.purse - result.spent)}`);
  lines.push("");
  lines.push("SQUAD:");
  result.squad.forEach((player, i) => {
    lines.push(`  ${i + 1}. ${player.name} (${player.role}) — ${formatCr(player.price)}`);
  });
  lines.push("");
  lines.push("IPL Auction Simulator 2027");
  return lines.join("\n");
}

export function shareSquadReport(result: AuctionResult): void {
  const text = formatSquadReport(result);
  if (navigator.share) {
    navigator.share({
      title: `${result.franchise} — IPL Auction 2027`,
      text
    }).catch(() => {
      copyToClipboard(text);
    });
  } else {
    copyToClipboard(text);
  }
}

export function downloadSquadReport(result: AuctionResult): void {
  const text = formatSquadReport(result);
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${result.franchise.toLowerCase().replace(/\s+/g, "-")}-auction-report.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function copyToClipboard(text: string): void {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try { document.execCommand("copy"); } catch { /* ignore */ }
  document.body.removeChild(textarea);
}
