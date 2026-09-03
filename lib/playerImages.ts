import type { Player } from "@/data/players/types";
import type { FranchiseId } from "@/data/teams/franchises";

import { playerAccent, playerInitials } from "@/data/players/assets";

export const ROLE_BADGE_COLORS: Record<string, string> = {
  BAT: "#e83e8c",
  BOWL: "#6ed0bd",
  AR: "#e27a47",
  WK: "#d1ab3e",
};

export const ROLE_LABELS: Record<string, string> = {
  BAT: "BAT",
  BOWL: "BOWL",
  AR: "AR",
  WK: "WK",
};

const NATIONALITY_FLAGS: Record<string, string> = {
  Indian: "\u{1F1EE}\u{1F1F3}",
  England: "\u{1F1EC}\u{1F1E7}",
  Australia: "\u{1F1E6}\u{1F1FA}",
  "New Zealand": "\u{1F1F3}\u{1F1FF}",
  "South Africa": "\u{1F1FF}\u{1F1E6}",
  Pakistan: "\u{1F1F5}\u{1F1F0}",
  Afghanistan: "\u{1F1E6}\u{1F1EB}",
  "West Indies": "\u{1F1F2}\u{1F1E8}",
  "Sri Lanka": "\u{1F1F1}\u{1F1F0}",
  Bangladesh: "\u{1F1E7}\u{1F1E9}",
};

const TEAM_GRADIENT_MAP: Record<string, [string, string]> = {
  KKR: ["#3a225d", "#6f3e83"],
  MI: ["#005da0", "#1f5b91"],
  RCB: ["#ba1f2e", "#a23d42"],
  CSK: ["#f5ce34", "#b18a29"],
  SRH: ["#f47a24", "#d66a23"],
  RR: ["#e83e8c", "#4269a5"],
  DC: ["#17479e", "#387595"],
  PBKS: ["#ed1b24", "#b94859"],
  LSG: ["#2f9bd7", "#3b8f9c"],
  GT: ["#1b2133", "#527082"],
};

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash;
}

function deterministicPlayerColor(playerId: string): [string, string] {
  const palette: [string, string][] = [
    ["#266f73", "#b55635"],
    ["#8c6b25", "#6a4f88"],
    ["#2f6f8f", "#a94d68"],
    ["#477258", "#8b5f3b"],
    ["#5c3d6e", "#2e8a7c"],
    ["#7a4a2a", "#3d6b9e"],
    ["#945530", "#345a78"],
    ["#2d7a5e", "#8a5c38"],
  ];
  return palette[hashId(playerId) % palette.length];
}

export function getTeamGradient(teamId: FranchiseId): [string, string] {
  return TEAM_GRADIENT_MAP[teamId] ?? ["#1b2133", "#527082"];
}

export function getNationalityFlag(nationality: string): string {
  return NATIONALITY_FLAGS[nationality] ?? "";
}

export function getPlayerColors(
  playerId: string,
  playerName: string,
  teamId?: FranchiseId,
): {
  initials: string;
  accent: string;
  gradient: [string, string];
  label: string;
} {
  return {
    initials: playerInitials(playerName),
    accent: playerAccent(playerId),
    gradient: teamId ? getTeamGradient(teamId) : deterministicPlayerColor(playerId),
    label: playerName,
  };
}

/**
 * Returns a CSS linear-gradient string representing the player card background.
 * When a teamId is provided, uses official franchise colors; otherwise falls
 * back to a deterministic palette derived from the player ID.
 */
export function getPlayerImage(
  playerId: string,
  playerName: string,
  teamId?: FranchiseId,
): string {
  const { gradient } = getPlayerColors(playerId, playerName, teamId);
  return `linear-gradient(145deg, ${gradient[0]}, ${gradient[1]})`;
}

export function getRoleBadgeColor(role: string): string {
  return ROLE_BADGE_COLORS[role] ?? "#6ed0bd";
}

/**
 * Generate a data-URI for a stylised player portrait using OffscreenCanvas
 * where available, falling back to a simple gradient + initials rendering
 * via an in-memory <canvas>. The result is a PNG data-URI suitable for use
 * as an <img> src.
 *
 * This runs only on the client (the caller guards with "use client" or
 * typeof window checks). The generated image includes:
 *  - Team-color gradient background
 *  - Player initials in large bold type
 *  - Role badge (BAT / BOWL / AR / WK)
 *  - Rating circle arc
 *  - National flag emoji
 */
export function generatePlayerPortrait(
  player: Pick<Player, "playerId" | "identity" | "role" | "simulationData">,
  options?: { teamId?: FranchiseId; size?: number },
): string | null {
  if (typeof document === "undefined") return null;

  const size = options?.size ?? 240;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const colors = getPlayerColors(
    player.playerId,
    player.identity.name,
    options?.teamId,
  );
  const role = player.role.primary;
  const overall = player.simulationData.overall;
  const flag = getNationalityFlag(player.identity.nationality);

  // --- background gradient ---
  const bgGrad = ctx.createLinearGradient(0, 0, size, size);
  bgGrad.addColorStop(0, colors.gradient[0]);
  bgGrad.addColorStop(1, colors.gradient[1]);
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 0, 0, size, size, size * 0.08);
  ctx.fill();

  // --- subtle radial highlight ---
  const hlGrad = ctx.createRadialGradient(size * 0.35, size * 0.25, 0, size * 0.5, size * 0.5, size * 0.7);
  hlGrad.addColorStop(0, "rgba(255,255,255,0.12)");
  hlGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = hlGrad;
  roundRect(ctx, 0, 0, size, size, size * 0.08);
  ctx.fill();

  // --- player initials ---
  const fontSize = size * 0.32;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `700 ${fontSize}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(colors.initials, size / 2, size * 0.42);

  // --- role badge ---
  const badgeH = size * 0.08;
  const badgeW = size * 0.17;
  const badgeX = size * 0.06;
  const badgeY = size - size * 0.16;
  ctx.fillStyle = getRoleBadgeColor(role);
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH * 0.3);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${badgeH * 0.65}px 'Barlow Condensed', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ROLE_LABELS[role] ?? role, badgeX + badgeW / 2, badgeY + badgeH / 2);

  // --- rating circle (right side) ---
  const circleRadius = size * 0.08;
  const circleX = size - size * 0.13;
  const circleY = size - size * 0.14;

  // background circle
  ctx.beginPath();
  ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fill();

  // progress arc
  const arcStart = -Math.PI / 2;
  const arcEnd = arcStart + (overall / 100) * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(circleX, circleY, circleRadius, arcStart, arcEnd);
  ctx.strokeStyle = overall >= 90 ? "#f0b18e" : overall >= 80 ? "#6ed0bd" : "#a9ded2";
  ctx.lineWidth = size * 0.012;
  ctx.lineCap = "round";
  ctx.stroke();

  // rating text
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${circleRadius * 0.9}px 'Barlow Condensed', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(overall), circleX, circleY);

  // --- flag emoji ---
  if (flag) {
    ctx.font = `${size * 0.09}px sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(flag, size - size * 0.06, size * 0.05);
  }

  return canvas.toDataURL("image/png", 0.85);
}

function roundRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
