"use client";

import { useState } from "react";
import type { CSSProperties, ImgHTMLAttributes } from "react";
import Image from "next/image";
import type { Player } from "@/data/players/types";
import type { FranchiseId } from "@/data/teams/franchises";
import { isSafePortraitSource, portraitForPlayer } from "@/data/players/assets";
import { getPlayerColors, getRoleBadgeColor, ROLE_LABELS } from "@/lib/playerImages";

export type PlayerPortraitProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  player: Player;
  size?: number;
  /** Render the fallback even when an asset URL exists (useful for QA). */
  forceFallback?: boolean;
  /** Optional team override for the gradient background. */
  teamId?: FranchiseId;
  /** Show a compact role badge overlay on the portrait. */
  showRoleBadge?: boolean;
  /** Show the overall rating as a small circle overlay. */
  showRating?: boolean;
};

/**
 * Shared portrait primitive for the market, stage card and intel drawer.
 * It never renders an unsafe/unknown URL and always has an accessible,
 * deterministic fallback, so a missing asset cannot break the auction room.
 *
 * When no licensed portrait is available the fallback is a stylised
 * gradient with the player's initials and role badge — generated from
 * `getPlayerColors` for a richer visual than plain initials.
 */
export function PlayerPortrait({
  player,
  size = 40,
  forceFallback = false,
  teamId,
  showRoleBadge = false,
  showRating = false,
  className,
  style,
  ...imageProps
}: PlayerPortraitProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const presentation = portraitForPlayer(player);
  const source = presentation.asset.src;
  const canRenderImage =
    !forceFallback &&
    !imageFailed &&
    source !== null &&
    isSafePortraitSource(source, presentation.asset.kind);
  const portraitStatus =
    canRenderImage && presentation.asset.kind !== "GENERATED"
      ? "LICENSED"
      : presentation.asset.kind === "GENERATED"
        ? "GENERATED"
        : "UNAVAILABLE";
  const accessibleLabel = canRenderImage
    ? presentation.asset.alt
    : `${presentation.label}, generated avatar placeholder — not a photograph`;

  const playerColors = getPlayerColors(
    player.playerId,
    player.identity.name,
    teamId,
  );
  const roleLabel = ROLE_LABELS[player.role.primary] ?? player.role.primary;
  const overall = player.simulationData.overall;
  const badgeColor = getRoleBadgeColor(player.role.primary);

  const gradientBg = canRenderImage
    ? presentation.accent
    : `linear-gradient(145deg, ${playerColors.gradient[0]}, ${playerColors.gradient[1]})`;

  const rootStyle: CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    background: gradientBg,
    position: "relative",
    ...style,
  };

  const ratingCircleSize = Math.max(14, size * 0.32);
  const ratingRadius = (ratingCircleSize - 4) / 2;
  const ratingCircumference = 2 * Math.PI * ratingRadius;
  const ratingOffset = ratingCircumference * (1 - overall / 100);

  return (
    <span
      className={className ? `player-portrait ${className}` : "player-portrait"}
      style={rootStyle}
      role={canRenderImage ? undefined : "img"}
      aria-label={canRenderImage ? undefined : accessibleLabel}
      data-asset-kind={presentation.asset.kind}
      data-asset-status={canRenderImage ? "loaded" : "fallback"}
      data-portrait-status={portraitStatus}
      data-source-ref={presentation.asset.sourceRef}
      data-role={roleLabel}
      title={canRenderImage ? undefined : accessibleLabel}
    >
      {canRenderImage ? (
        <Image
          {...imageProps}
          src={source}
          alt={presentation.asset.alt}
          width={size}
          height={size}
          loading={imageProps.loading ?? "lazy"}
          decoding={imageProps.decoding ?? "async"}
          unoptimized
          onError={(event) => {
            setImageFailed(true);
            imageProps.onError?.(event);
          }}
        />
      ) : (
        <span
          aria-hidden="true"
          className="player-portrait-fallback"
          style={{
            display: "grid",
            placeItems: "center",
            width: "100%",
            height: "100%",
            position: "relative",
          }}
        >
          <span>{presentation.initials}</span>
          {!showRoleBadge && <small>{roleLabel}</small>}
        </span>
      )}

      {showRoleBadge && !canRenderImage && (
        <span
          style={{
            position: "absolute",
            bottom: size * 0.08,
            left: size * 0.06,
            fontSize: Math.max(6, size * 0.13),
            fontWeight: 700,
            color: "#fff",
            background: badgeColor,
            padding: `${Math.max(1, size * 0.02)}px ${Math.max(2, size * 0.05)}px`,
            borderRadius: Math.max(2, size * 0.04),
            lineHeight: "1.3",
            fontFamily: "'Barlow Condensed', sans-serif",
            letterSpacing: "0.5px",
          }}
        >
          {roleLabel}
        </span>
      )}

      {showRating && (
        <span
          style={{
            position: "absolute",
            top: Math.max(2, size * 0.05),
            right: Math.max(2, size * 0.05),
            width: ratingCircleSize,
            height: ratingCircleSize,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
          }}
        >
          <svg
            width={ratingCircleSize}
            height={ratingCircleSize}
            viewBox={`0 0 ${ratingCircleSize} ${ratingCircleSize}`}
            style={{ position: "absolute", inset: 0 }}
          >
            <circle
              cx={ratingCircleSize / 2}
              cy={ratingCircleSize / 2}
              r={ratingRadius}
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={Math.max(1.5, size * 0.03)}
            />
            <circle
              cx={ratingCircleSize / 2}
              cy={ratingCircleSize / 2}
              r={ratingRadius}
              fill="none"
              stroke={overall >= 90 ? "#f0b18e" : overall >= 80 ? "#6ed0bd" : "#a9ded2"}
              strokeWidth={Math.max(1.5, size * 0.03)}
              strokeLinecap="round"
              strokeDasharray={ratingCircumference}
              strokeDashoffset={ratingOffset}
              transform={`rotate(-90 ${ratingCircleSize / 2} ${ratingCircleSize / 2})`}
            />
          </svg>
          <span
            style={{
              fontSize: Math.max(6, ratingCircleSize * 0.42),
              fontWeight: 700,
              color: "#fff",
              fontFamily: "'Barlow Condensed', sans-serif",
              lineHeight: 1,
              position: "relative",
              zIndex: 1,
            }}
          >
            {overall}
          </span>
        </span>
      )}
    </span>
  );
}
