import type { Player, PlayerPortraitAsset, PlayerPortraitKind } from "@/data/players/types";

/**
 * Version this independently from player facts. A save can therefore detect
 * an asset-pack update without invalidating a deterministic auction replay.
 */
export const PLAYER_ASSET_MANIFEST_VERSION = "2027-assets.1.1";

const PORTRAIT_ROOT = "/assets/players";

/**
 * Licensed portrait entries belong here. Keeping overrides separate from the
 * player pool prevents factual data updates from silently changing artwork.
 * The pack intentionally starts empty until usage rights and source metadata
 * are available.
 */
export const PLAYER_PORTRAIT_MANIFEST: Readonly<Record<string, PlayerPortraitAsset>> = Object.freeze({});

export type PortraitManifestValidation = { valid: boolean; errors: string[] };

export type PortraitPresentation = {
  asset: PlayerPortraitAsset;
  initials: string;
  accent: string;
  label: string;
};

/** Stable two-letter label used when a portrait is unavailable or blocked. */
export function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Small deterministic palette keeps fallback avatars consistent across views. */
export function playerAccent(playerId: string): string {
  let hash = 0;
  for (let index = 0; index < playerId.length; index += 1) hash = (hash * 31 + playerId.charCodeAt(index)) >>> 0;
  const palette = ["#b55635", "#266f73", "#8c6b25", "#6a4f88", "#2f6f8f", "#a94d68", "#477258", "#8b5f3b"];
  return palette[hash % palette.length];
}

/**
 * Explicitly generated fallback asset. This is intentionally not a data URL
 * or a stock-photo URL: no fabricated face can be mistaken for a real player.
 */
export function generatedPortraitAsset(name: string): PlayerPortraitAsset {
  return {
    kind: "GENERATED",
    src: null,
    alt: `${name} portrait placeholder`,
    fallback: "INITIALS",
    sourceRef: "ui-generated-initials",
    license: "Original UI fallback"
  };
}

export function playerAssets(playerId: string, name: string) {
  return {
    manifestVersion: PLAYER_ASSET_MANIFEST_VERSION,
    portrait: PLAYER_PORTRAIT_MANIFEST[playerId] ?? generatedPortraitAsset(name)
  } as const;
}

/**
 * Validate an externally assembled portrait pack before it reaches players.
 * Files and URLs are still checked again at render time; this catches broken
 * licensing metadata and invalid paths during ingestion/build.
 */
export function validatePlayerPortraitManifest(manifest: Readonly<Record<string, PlayerPortraitAsset>>): PortraitManifestValidation {
  const errors: string[] = [];
  Object.entries(manifest).forEach(([playerId, asset]) => {
    const path = `portrait[${playerId || "missing-id"}]`;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(playerId)) errors.push(`${path}: player ID must be a lowercase slug`);
    if (!asset || typeof asset !== "object") {
      errors.push(`${path}: asset must be an object`);
      return;
    }
    if (!["LOCAL", "REMOTE"].includes(asset.kind)) errors.push(`${path}: licensed manifest kind must be LOCAL or REMOTE`);
    if (asset.kind === "GENERATED") errors.push(`${path}: generated fallbacks do not belong in the licensed manifest`);
    if (typeof asset.src !== "string" || !isSafePortraitSource(asset.src, asset.kind)) errors.push(`${path}: source path is unsafe or unsupported`);
    if (typeof asset.alt !== "string" || !asset.alt.trim()) errors.push(`${path}: alt text is required`);
    if (typeof asset.sourceRef !== "string" || !asset.sourceRef.trim()) errors.push(`${path}: sourceRef is required`);
    if (typeof asset.license !== "string" || !asset.license.trim()) errors.push(`${path}: license note is required`);
    if (!(["INITIALS", "SILHOUETTE"] as const).includes(asset.fallback)) errors.push(`${path}: fallback is invalid`);
  });
  return { valid: errors.length === 0, errors };
}

export const PLAYER_PORTRAIT_MANIFEST_VALIDATION = validatePlayerPortraitManifest(PLAYER_PORTRAIT_MANIFEST);

if (!PLAYER_PORTRAIT_MANIFEST_VALIDATION.valid) {
  throw new Error(`Invalid player portrait manifest: ${PLAYER_PORTRAIT_MANIFEST_VALIDATION.errors.join("; ")}`);
}

/**
 * Build the canonical presentation descriptor. The optional local manifest
 * path is deterministic and can be populated later with licensed artwork;
 * absent files naturally fall back to initials through the component.
 */
export function portraitForPlayer(player: Pick<Player, "playerId" | "identity" | "assets">): PortraitPresentation {
  const asset = player.assets?.portrait ?? generatedPortraitAsset(player.identity.name);
  return {
    asset,
    initials: playerInitials(player.identity.name),
    accent: playerAccent(player.playerId),
    label: player.identity.name
  };
}

/**
 * Validate a manifest URL before applying it to CSS. Remote images are only
 * accepted over HTTPS; local images must remain under the public asset root.
 */
export function isSafePortraitSource(source: string, kind: PlayerPortraitKind): boolean {
  if (typeof source !== "string" || !source.trim()) return false;
  if (kind === "REMOTE") {
    try {
      const url = new URL(source);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }
  if (kind === "LOCAL") return source.startsWith(`${PORTRAIT_ROOT}/`) && !source.includes("..") && /^\/assets\/players\/[a-z0-9][a-z0-9/_-]*\.(avif|webp|png|jpe?g)$/i.test(source);
  return false;
}
