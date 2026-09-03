import { describe, expect, it } from "vitest";
import { PLAYERS_2027 } from "@/data/players/2027";
import { canAddPlayer, validateSquad } from "./squadRules";

const rules = { maxSquadSize: 3, minSquadSize: 2, maxOverseas: 1 };
const indian = PLAYERS_2027.find((player) => player.auctionData.nationalityStatus === "INDIAN")!;
const overseas = PLAYERS_2027.find((player) => player.auctionData.nationalityStatus === "OVERSEAS")!;

describe("squad rules", () => {
  it("rejects duplicate and unknown ownership", () => {
    const validation = validateSquad([indian.playerId, indian.playerId, "missing-player"], PLAYERS_2027, rules);
    expect(validation.violations.map((violation) => violation.code)).toEqual(expect.arrayContaining(["DUPLICATE_PLAYER", "UNKNOWN_PLAYER"]));
  });

  it("enforces the overseas cap before a bid is accepted", () => {
    expect(canAddPlayer([overseas.playerId], PLAYERS_2027.find((player) => player.auctionData.nationalityStatus === "OVERSEAS" && player.playerId !== overseas.playerId)!, rules, PLAYERS_2027)).toBe(false);
  });

  it("can require minimum squad construction", () => {
    const validation = validateSquad([indian.playerId], PLAYERS_2027, rules, true);
    expect(validation.valid).toBe(false);
    expect(validation.violations.some((violation) => violation.code === "MIN_SQUAD_SIZE")).toBe(true);
  });
});

