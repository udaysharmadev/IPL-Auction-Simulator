import { NextRequest, NextResponse } from "next/server";
import {
  ONBOARDING_CHECKPOINT_COOKIE,
  parseCheckpoint,
  redirectFor,
  progressFromCheckpoint,
  requiredPath
} from "@/domain/onboarding";

const guardedPrefixes = [
  "/",
  "/rules",
  "/setup",
  "/franchise",
  "/war-room",
  "/auction"
] as const;

function isGuardedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return guardedPrefixes.some((prefix) => prefix !== "/" && (pathname === prefix || pathname.startsWith(`${prefix}/`)));
}

/**
 * Guard only the game routes. Static assets, Next internals and future API
 * routes remain untouched. The cookie is a checkpoint hint, never a source of
 * game truth; the client store still owns the full state.
 */
export function middleware(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  if (!isGuardedPath(pathname)) return NextResponse.next();

  const checkpoint = parseCheckpoint(request.cookies.get(ONBOARDING_CHECKPOINT_COOKIE)?.value);
  const progress = checkpoint ? progressFromCheckpoint(checkpoint) : {
    rulesAccepted: false,
    setup: null,
    franchiseId: null,
    introSeen: false,
    readyForAuction: false,
    auctionComplete: false
  };

  // `/` is a boot/resume endpoint, never a visible game screen.
  const target = pathname === "/" ? requiredPath(progress) : redirectFor(pathname, progress);
  if (!target || target === pathname) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = target;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/",
    "/rules/:path*",
    "/setup/:path*",
    "/franchise/:path*",
    "/war-room/:path*",
    "/auction/:path*"
  ]
};

