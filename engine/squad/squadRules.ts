import type { Role, Player } from "@/data/players/types";

export type SquadRulesConfig = {
  maxSquadSize: number;
  minSquadSize: number;
  maxOverseas: number;
  roleTargets?: Partial<Record<Role, number>>;
};

export type SquadViolationCode = "MAX_SQUAD_SIZE" | "OVERSEAS_LIMIT" | "DUPLICATE_PLAYER" | "UNKNOWN_PLAYER" | "MIN_SQUAD_SIZE" | "ROLE_COVERAGE";

export type SquadViolation = { code: SquadViolationCode; message: string; playerId?: string };

export type SquadValidation = {
  valid: boolean;
  violations: SquadViolation[];
  overseasCount: number;
  roleCounts: Record<Role, number>;
  remainingSlots: number;
};

export const DEFAULT_ROLE_TARGETS: Record<Role, number> = { BAT: 5, BOWL: 5, AR: 3, WK: 2 };

const emptyRoleCounts = (): Record<Role, number> => ({ BAT: 0, BOWL: 0, AR: 0, WK: 0 });

function playerById(players: readonly Player[]) {
  return new Map(players.map((player) => [player.playerId, player]));
}

export function overseasCount(squad: readonly string[], players: readonly Player[]): number {
  const byId = playerById(players);
  return squad.reduce((count, id) => count + (byId.get(id)?.auctionData.nationalityStatus === "OVERSEAS" ? 1 : 0), 0);
}

export function canAddPlayer(squad: readonly string[], player: Player, rules: SquadRulesConfig, players: readonly Player[]): boolean {
  if (squad.length >= rules.maxSquadSize) return false;
  if (squad.includes(player.playerId)) return false;
  return player.auctionData.nationalityStatus !== "OVERSEAS" || overseasCount(squad, players) < rules.maxOverseas;
}

/**
 * Cheapest legal purse reserve required to reach the minimum squad size after
 * buying a candidate. Returns Infinity when the remaining pool cannot produce
 * a legal minimum squad.
 */
export function minimumCompletionReserve(
  squad: readonly string[],
  candidate: Player,
  remainingPlayers: readonly Player[],
  rules: SquadRulesConfig,
  players: readonly Player[]
): number {
  if (!canAddPlayer(squad, candidate, rules, players)) return Number.POSITIVE_INFINITY;
  const projectedSquad = [...squad, candidate.playerId];
  let slotsNeeded = Math.max(0, rules.minSquadSize - projectedSquad.length);
  if (slotsNeeded === 0) return 0;

  let reserve = 0;
  const available = remainingPlayers
    .filter((player) => player.playerId !== candidate.playerId && !projectedSquad.includes(player.playerId))
    .sort((left, right) => left.auctionData.basePrice - right.auctionData.basePrice || left.playerId.localeCompare(right.playerId));

  for (const player of available) {
    if (!canAddPlayer(projectedSquad, player, rules, players)) continue;
    projectedSquad.push(player.playerId);
    reserve += player.auctionData.basePrice;
    slotsNeeded -= 1;
    if (slotsNeeded === 0) return Number(reserve.toFixed(2));
  }
  return Number.POSITIVE_INFINITY;
}

export function validateSquad(squad: readonly string[], players: readonly Player[], rules: SquadRulesConfig, requireMinimum = false): SquadValidation {
  const byId = playerById(players);
  const violations: SquadViolation[] = [];
  const roleCounts = emptyRoleCounts();
  const seen = new Set<string>();
  let overseas = 0;

  squad.forEach((id) => {
    const player = byId.get(id);
    if (seen.has(id)) violations.push({ code: "DUPLICATE_PLAYER", message: `Player ${id} is listed more than once.`, playerId: id });
    seen.add(id);
    if (!player) {
      violations.push({ code: "UNKNOWN_PLAYER", message: `Player ${id} is not present in the active dataset.`, playerId: id });
      return;
    }
    roleCounts[player.role.primary] += 1;
    if (player.auctionData.nationalityStatus === "OVERSEAS") overseas += 1;
  });

  if (squad.length > rules.maxSquadSize) violations.push({ code: "MAX_SQUAD_SIZE", message: `Squad cannot exceed ${rules.maxSquadSize} players.` });
  if (overseas > rules.maxOverseas) violations.push({ code: "OVERSEAS_LIMIT", message: `Squad cannot contain more than ${rules.maxOverseas} overseas players.` });
  if (requireMinimum && squad.length < rules.minSquadSize) violations.push({ code: "MIN_SQUAD_SIZE", message: `Squad needs at least ${rules.minSquadSize} players.` });

  const targets = { ...DEFAULT_ROLE_TARGETS, ...rules.roleTargets };
  if (requireMinimum) {
    (Object.keys(targets) as Role[]).forEach((role) => {
      if (roleCounts[role] < targets[role]) violations.push({ code: "ROLE_COVERAGE", message: `Squad needs ${targets[role]} ${role} players; currently has ${roleCounts[role]}.` });
    });
  }
  return { valid: violations.length === 0, violations, overseasCount: overseas, roleCounts, remainingSlots: Math.max(0, rules.maxSquadSize - squad.length) };
}

export function buildRoleNeeds(squad: readonly string[], players: readonly Player[], rules: SquadRulesConfig = { maxSquadSize: 25, minSquadSize: 12, maxOverseas: 8 }): Array<{ role: Role; label: string; count: number; priority: "A" | "B" }> {
  const validation = validateSquad(squad, players, rules);
  const targets = { ...DEFAULT_ROLE_TARGETS, ...rules.roleTargets };
  const labels: Record<Role, string> = { BAT: "Batting depth", BOWL: "Death bowling", AR: "All-rounder cover", WK: "Wicketkeeper" };
  return (Object.keys(targets) as Role[]).map((role) => ({ role, label: labels[role], count: Math.max(0, targets[role] - validation.roleCounts[role]), priority: role === "BOWL" && validation.roleCounts.BOWL < 2 ? "A" : "B" }));
}
