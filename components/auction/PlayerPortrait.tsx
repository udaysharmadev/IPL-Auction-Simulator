"use client";

import { useState } from "react";
import type { CSSProperties, ImgHTMLAttributes } from "react";
import Image from "next/image";
import type { Player } from "@/data/players/types";
import { isSafePortraitSource, portraitForPlayer } from "@/data/players/assets";

export type PlayerPortraitProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  player: Player;
  size?: number;
  /** Render the fallback even when an asset URL exists (useful for QA). */
  forceFallback?: boolean;
};

/**
 * Shared portrait primitive for the market, stage card and intel drawer.
 * It never renders an unsafe/unknown URL and always has an accessible,
 * deterministic fallback, so a missing asset cannot break the auction room.
 */
export function PlayerPortrait({ player, size = 40, forceFallback = false, className, style, ...imageProps }: PlayerPortraitProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const presentation = portraitForPlayer(player);
  const source = presentation.asset.src;
  const canRenderImage = !forceFallback && !imageFailed && source !== null && isSafePortraitSource(source, presentation.asset.kind);
  const portraitStatus = canRenderImage && presentation.asset.kind !== "GENERATED" ? "LICENSED" : presentation.asset.kind === "GENERATED" ? "GENERATED" : "UNAVAILABLE";
  const accessibleLabel = canRenderImage
    ? presentation.asset.alt
    : `${presentation.label}, generated avatar placeholder — not a photograph`;
  const rootStyle: CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    background: `linear-gradient(145deg, ${presentation.accent}, #14262d)`,
    ...style
  };
  const roleLabel = player.role.primary === "AR" ? "AR" : player.role.primary;

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
        <span aria-hidden="true" className="player-portrait-fallback"><span>{presentation.initials}</span><small>{roleLabel}</small></span>
      )}
    </span>
  );
}
