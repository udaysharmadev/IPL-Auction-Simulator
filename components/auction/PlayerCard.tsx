"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { Player } from "@/data/players/types";
import type { FranchiseId } from "@/data/teams/franchises";
import {
  getPlayerColors,
  getRoleBadgeColor,
  getNationalityFlag,
  ROLE_LABELS,
} from "@/lib/playerImages";
const formatCr = (value: number) => `₹${value.toFixed(value % 1 === 0 ? 0 : 2)} Cr`;

type CardSize = "sm" | "md" | "lg" | "xl";

type Props = {
  player: Player;
  size: CardSize;
  showStats?: boolean;
  animate?: boolean;
  highlight?: boolean;
  teamId?: FranchiseId;
  onClick?: () => void;
};

const SIZE_CONFIG = {
  sm: { width: 120, height: 160, initialsSize: 18, nameSize: 9, metaSize: 7, badgeSize: 7, ratingSize: 12 },
  md: { width: 170, height: 220, initialsSize: 26, nameSize: 11, metaSize: 9, badgeSize: 8, ratingSize: 16 },
  lg: { width: 230, height: 300, initialsSize: 36, nameSize: 14, metaSize: 11, badgeSize: 10, ratingSize: 22 },
  xl: { width: 320, height: 430, initialsSize: 48, nameSize: 18, metaSize: 13, badgeSize: 12, ratingSize: 30 },
};

const STAT_LABELS = {
  BAT: ["Matches", "Runs", "Avg", "SR"],
  BOWL: ["Matches", "Wkts", "Econ", "Avg"],
  AR: ["Matches", "Runs", "Wkts", "Econ"],
  WK: ["Matches", "Runs", "Catches", "Stumpings"],
};

export function PlayerCard({
  player,
  size,
  showStats = false,
  animate = false,
  highlight = false,
  teamId,
  onClick,
}: Props) {
  const colors = useMemo(
    () => getPlayerColors(player.playerId, player.identity.name, teamId),
    [player.playerId, player.identity.name, teamId],
  );
  const config = SIZE_CONFIG[size];
  const role = player.role.primary;
  const overall = player.simulationData.overall;
  const flag = getNationalityFlag(player.identity.nationality);

  const statValues = useMemo(() => {
    const rd = player.realData;
    const roleKey = role as keyof typeof STAT_LABELS;
    const labels = STAT_LABELS[roleKey] ?? STAT_LABELS.BAT;
    const values: string[] = [];
    values.push(String(rd.iplMatches));
    if (role === "BAT" || role === "WK" || role === "AR") {
      values.push(String(rd.runs));
    } else {
      values.push(String(rd.wickets));
    }
    if (role === "BAT" || role === "WK") {
      values.push(rd.battingAverage != null ? String(rd.battingAverage) : "\u2014");
      values.push(rd.strikeRate != null ? String(rd.strikeRate) : "\u2014");
    } else if (role === "BOWL") {
      values.push(rd.economy != null ? String(rd.economy) : "\u2014");
      values.push(rd.bowlingAverage != null ? String(rd.bowlingAverage) : "\u2014");
    } else {
      values.push(rd.battingAverage != null ? String(rd.battingAverage) : "\u2014");
      values.push(rd.economy != null ? String(rd.economy) : "\u2014");
    }
    return { labels, values };
  }, [player, role]);

  const roleLabel = ROLE_LABELS[role] ?? role;
  const isXL = size === "xl";
  const showFullStats = showStats || isXL;

  const cardStyle: CSSProperties = {
    width: config.width,
    height: showFullStats ? "auto" : config.height,
    minWidth: config.width,
    borderRadius: 10,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    border: `2px solid ${colors.accent}55`,
    background: "#101c21",
    cursor: onClick ? "pointer" : "default",
    position: "relative",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    flexShrink: 0,
    ...(animate ? { animation: "playerCardSlideIn 0.4s ease-out both" } : {}),
    ...(highlight ? { boxShadow: `0 0 0 2px ${colors.accent}, 0 0 24px ${colors.accent}44, 0 0 48px ${colors.accent}22`, animation: "playerCardPulse 2s ease-in-out infinite" } : {}),
  };

  const portraitStyle: CSSProperties = {
    width: "100%",
    height: isXL ? 200 : size === "lg" ? 150 : size === "md" ? 110 : 80,
    background: `linear-gradient(145deg, ${colors.gradient[0]}, ${colors.gradient[1]})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  };

  const highlightOverlay: CSSProperties = {
    position: "absolute",
    inset: 0,
    background: "radial-gradient(circle at 35% 25%, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0) 60%)",
    pointerEvents: "none",
  };

  const ratingCircleStyle = (value: number): CSSProperties => {
    const circleR = isXL ? 22 : size === "lg" ? 17 : size === "md" ? 13 : 10;
    const circumference = 2 * Math.PI * circleR;
    const dashoffset = circumference * (1 - value / 100);
    return {
      width: circleR * 2 + 8,
      height: circleR * 2 + 8,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "absolute",
      top: 6,
      right: 6,
    };
  };

  const bodyStyle: CSSProperties = {
    padding: isXL ? "14px 16px" : size === "lg" ? "10px 12px" : "7px 8px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: isXL ? 6 : 3,
  };

  return (
    <div
      className="player-card"
      style={cardStyle}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      aria-label={`${player.identity.name}, ${roleLabel}, ${player.identity.nationality}, Overall ${overall}`}
    >
      <div className="player-card-portrait" style={portraitStyle}>
        <div style={highlightOverlay} />
        <span
          style={{
            fontSize: config.initialsSize,
            fontWeight: 700,
            color: "rgba(255,255,255,0.95)",
            fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
            letterSpacing: "1px",
            userSelect: "none",
          }}
        >
          {colors.initials}
        </span>
        <div style={ratingCircleStyle(overall)}>
          <svg width="100%" height="100%" viewBox={`0 0 ${(isXL ? 22 : size === "lg" ? 17 : size === "md" ? 13 : 10) * 2 + 8} ${(isXL ? 22 : size === "lg" ? 17 : size === "md" ? 13 : 10) * 2 + 8}`}>
            <circle
              cx={(isXL ? 22 : size === "lg" ? 17 : size === "md" ? 13 : 10) + 4}
              cy={(isXL ? 22 : size === "lg" ? 17 : size === "md" ? 13 : 10) + 4}
              r={isXL ? 22 : size === "lg" ? 17 : size === "md" ? 13 : 10}
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={isXL ? 3 : 2}
            />
            <circle
              cx={(isXL ? 22 : size === "lg" ? 17 : size === "md" ? 13 : 10) + 4}
              cy={(isXL ? 22 : size === "lg" ? 17 : size === "md" ? 13 : 10) + 4}
              r={isXL ? 22 : size === "lg" ? 17 : size === "md" ? 13 : 10}
              fill="none"
              stroke={overall >= 90 ? "#f0b18e" : overall >= 80 ? "#6ed0bd" : "#a9ded2"}
              strokeWidth={isXL ? 3 : 2}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * (isXL ? 22 : size === "lg" ? 17 : size === "md" ? 13 : 10)}
              strokeDashoffset={2 * Math.PI * (isXL ? 22 : size === "lg" ? 17 : size === "md" ? 13 : 10) * (1 - overall / 100)}
              transform={`rotate(-90 ${(isXL ? 22 : size === "lg" ? 17 : size === "md" ? 13 : 10) + 4} ${(isXL ? 22 : size === "lg" ? 17 : size === "md" ? 13 : 10) + 4})`}
            />
          </svg>
          <span
            style={{
              position: "absolute",
              fontSize: config.ratingSize * 0.65,
              fontWeight: 700,
              color: "#fff",
              fontFamily: "'Barlow Condensed', sans-serif",
              lineHeight: 1,
            }}
          >
            {overall}
          </span>
        </div>
        {flag && (
          <span
            style={{
              position: "absolute",
              top: 4,
              left: 6,
              fontSize: isXL ? 18 : size === "lg" ? 14 : size === "md" ? 11 : 9,
              lineHeight: 1,
            }}
          >
            {flag}
          </span>
        )}
      </div>

      <div style={bodyStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              fontSize: config.badgeSize,
              fontWeight: 700,
              color: "#fff",
              background: getRoleBadgeColor(role),
              padding: "1px 4px",
              borderRadius: 3,
              lineHeight: "1.3",
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: "0.5px",
            }}
          >
            {roleLabel}
          </span>
          {player.auctionData.nationalityStatus === "OVERSEAS" && (
            <span
              style={{
                fontSize: config.badgeSize * 0.85,
                fontWeight: 600,
                color: "#e27a47",
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: "0.3px",
              }}
            >
              OS
            </span>
          )}
        </div>

        <div
          style={{
            fontWeight: 700,
            fontSize: config.nameSize,
            color: "#f4eee2",
            fontFamily: "'Barlow Condensed', sans-serif",
            lineHeight: 1.15,
            letterSpacing: "0.3px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {player.identity.name}
        </div>

        <div
          style={{
            fontSize: config.metaSize,
            color: "#74868d",
            fontFamily: "'Barlow Condensed', sans-serif",
            display: "flex",
            alignItems: "center",
            gap: 4,
            lineHeight: 1.2,
          }}
        >
          <span>{player.identity.nationality}</span>
          <span style={{ color: "var(--orange, #e27a47)" }}>&#8226;</span>
          <span>{player.auctionData.cappedStatus}</span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: isXL ? 6 : 2,
          }}
        >
          <span
            style={{
              fontSize: config.nameSize * 0.9,
              fontWeight: 600,
              color: "#9eb9b4",
              fontFamily: "'Barlow Condensed', sans-serif",
            }}
          >
            {formatCr(player.auctionData.basePrice)}
          </span>
          <span
            style={{
              fontSize: config.metaSize,
              color: "#5e747a",
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: "0.5px",
            }}
          >
            BASE
          </span>
        </div>
      </div>

      {showFullStats && (
        <div
          style={{
            padding: "0 12px 12px",
            borderTop: "1px solid rgba(198,220,231,0.08)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 4,
              marginTop: 8,
            }}
          >
            {statValues.labels.map((label, i) => (
              <div
                key={label}
                style={{
                  textAlign: "center",
                  padding: "6px 2px",
                  background: "#192930",
                  borderRadius: 3,
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: 8,
                    fontWeight: 600,
                    color: "#5e747a",
                    fontFamily: "'Barlow Condensed', sans-serif",
                    letterSpacing: "0.7px",
                    textTransform: "uppercase" as const,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#d6e4df",
                    fontFamily: "'Barlow Condensed', sans-serif",
                    marginTop: 2,
                  }}
                >
                  {statValues.values[i]}
                </span>
              </div>
            ))}
          </div>

          {player.role.specialization && (
            <div
              style={{
                marginTop: 8,
                padding: "5px 7px",
                background: "#14252b",
                border: "1px solid rgba(198,220,231,0.06)",
                fontSize: 9,
                color: "#7e9297",
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: "0.5px",
              }}
            >
              {player.role.specialization}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
              marginTop: 6,
            }}
          >
            <StatMini label="POTENTIAL" value={String(player.simulationData.potential)} />
            <StatMini label="FORM" value={player.simulationData.formTrend} />
            <StatMini label="SCARCITY" value={player.valuation.scarcity} />
            <StatMini label="VALUE" value={formatCr(player.valuation.fairValue)} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes playerCardSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes playerCardPulse {
          0%, 100% { box-shadow: 0 0 0 2px ${colors.accent}, 0 0 24px ${colors.accent}44, 0 0 48px ${colors.accent}22; }
          50% { box-shadow: 0 0 0 3px ${colors.accent}, 0 0 36px ${colors.accent}66, 0 0 64px ${colors.accent}33; }
        }
      `}</style>
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "4px 6px", background: "#192930", borderRadius: 3 }}>
      <span
        style={{
          display: "block",
          fontSize: 7,
          fontWeight: 600,
          color: "#5e747a",
          fontFamily: "'Barlow Condensed', sans-serif",
          letterSpacing: "0.7px",
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "#d6e4df",
          fontFamily: "'Barlow Condensed', sans-serif",
          marginTop: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}
