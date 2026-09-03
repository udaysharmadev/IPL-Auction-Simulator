"use client";

import { useEffect, useRef } from "react";
import type { CameraShot } from "@/engine/auctionPresentation";
import { renderQualityProfile } from "@/domain/rendering";
import type { GraphicsQuality } from "@/domain/onboarding";

type Props = { tension: number; shot: CameraShot; accent: string; active: boolean; soundOn: boolean; quality?: GraphicsQuality };

type Particle = { x: number; y: number; r: number; speed: number; phase: number; alpha: number };

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

export function AuctionRoomCanvas({ tension, shot, accent, active, soundOn, quality = "HIGH" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const stateRef = useRef({ tension, shot, accent, active, soundOn, quality });

  useEffect(() => { stateRef.current = { tension, shot, accent, active, soundOn, quality }; }, [tension, shot, accent, active, soundOn, quality]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!context) return;
    const reducedMotion = window.matchMedia(reducedMotionQuery);
    const renderProfile = renderQualityProfile(quality);
    const particles: Particle[] = Array.from({ length: renderProfile.particleCount }, (_, index) => ({ x: (index * 71) % 1000, y: (index * 37) % 560, r: 1 + (index % 3) * 0.5, speed: 0.08 + (index % 5) * 0.018, phase: index * 1.7, alpha: 0.12 + (index % 4) * 0.035 }));
    let width = 1;
    let height = 1;
    let dpr = 1;
    let lastTime = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, renderProfile.maxDevicePixelRatio);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const draw = (time: number) => {
      const frameDelta = Math.min(64, time - lastTime || 16.67);
      lastTime = time;
      const state = stateRef.current;
      const scaleX = width / 1000;
      const scaleY = height / 560;
      const scale = Math.min(scaleX, scaleY);
      const centerX = width * 0.5;
      const stageY = height * 0.38;
      const intensity = Math.max(0.15, Math.min(1, state.tension / 100));
      const accentRgb = hexToRgb(state.accent);

      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "screen";

      drawLightCone(context, centerX, stageY, Math.max(130, width * 0.28), height * 0.9, `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${0.035 + intensity * 0.07})`);
      drawLightCone(context, width * 0.17, height * 0.16, width * 0.16, height * 0.62, `rgba(105,220,206,${0.025 + intensity * 0.03})`);
      drawLightCone(context, width * 0.83, height * 0.16, width * 0.16, height * 0.62, `rgba(226,122,71,${0.025 + intensity * 0.04})`);

      drawStageGlow(context, centerX, stageY + height * 0.15, width * 0.31, `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},${0.07 + intensity * 0.1})`);
      drawFloorLines(context, width, height, scale);
      drawDeskLights(context, width, height, state.shot, intensity);
      drawCrowd(context, width, height, particles, time, reducedMotion.matches);

      if (state.shot === "FINAL_CALL") drawVignette(context, width, height, intensity);
      if (state.shot === "HAMMER_SOLD" && !reducedMotion.matches && renderProfile.enableSaleBurst) drawSaleBurst(context, centerX, stageY, width, time);
      if (state.active && !reducedMotion.matches && renderProfile.enablePulse) drawPulse(context, centerX, stageY, intensity, time);
      context.restore();

      if (!state.active && !state.soundOn) {
        context.fillStyle = "rgba(5,12,15,.1)";
        context.fillRect(0, 0, width, height);
      }
      frameRef.current = window.requestAnimationFrame(draw);
      void frameDelta;
    };

    frameRef.current = window.requestAnimationFrame(draw);
    return () => { observer.disconnect(); if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current); };
  }, [quality]);

  return <canvas ref={canvasRef} className="auction-room-canvas" aria-hidden="true" />;
}

function drawLightCone(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  context.save();
  context.beginPath();
  context.moveTo(x - width * 0.18, y);
  context.lineTo(x + width * 0.18, y);
  context.lineTo(x + width, y + height);
  context.lineTo(x - width, y + height);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.restore();
}

function drawStageGlow(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawFloorLines(context: CanvasRenderingContext2D, width: number, height: number, scale: number) {
  context.save();
  context.strokeStyle = "rgba(137,208,200,.09)";
  context.lineWidth = 1;
  for (let index = -6; index <= 6; index += 1) {
    const x = width * 0.5 + index * 65 * scale;
    context.beginPath();
    context.moveTo(width * 0.5 + index * 20 * scale, height * 0.69);
    context.lineTo(x, height * 1.04);
    context.stroke();
  }
  context.restore();
}

function drawDeskLights(context: CanvasRenderingContext2D, width: number, height: number, shot: CameraShot, intensity: number) {
  const positions = [0.12, 0.28, 0.42, 0.58, 0.72, 0.88];
  positions.forEach((position, index) => {
    const x = width * position;
    const y = height * (0.71 + (index % 2) * 0.055);
    const isFocus = shot === "BID_FOCUS" && index === 3 || shot === "RIVAL_REACTION" && index === 1;
    context.fillStyle = isFocus ? `rgba(226,122,71,${0.35 + intensity * 0.25})` : "rgba(105,205,195,.13)";
    context.fillRect(x - 17, y, 34, 2);
    context.shadowColor = context.fillStyle;
    context.shadowBlur = isFocus ? 14 : 5;
    context.fillRect(x - 8, y - 4, 16, 2);
    context.shadowBlur = 0;
  });
}

function drawCrowd(context: CanvasRenderingContext2D, width: number, height: number, particles: Particle[], time: number, reducedMotion: boolean) {
  particles.forEach((particle, index) => {
    const x = width * (0.06 + ((particle.x + index * 4) % 920) / 1000);
    const baseY = height * (0.58 + ((particle.y + index * 2) % 80) / 560);
    const motion = reducedMotion ? 0 : Math.sin(time * particle.speed * 0.01 + particle.phase) * 2;
    context.fillStyle = `rgba(${index % 3 === 0 ? "226,122,71" : "148,201,194"},${particle.alpha})`;
    context.beginPath();
    context.arc(x, baseY + motion, particle.r, 0, Math.PI * 2);
    context.fill();
  });
}

function drawVignette(context: CanvasRenderingContext2D, width: number, height: number, intensity: number) {
  const gradient = context.createRadialGradient(width * 0.5, height * 0.42, width * 0.08, width * 0.5, height * 0.42, width * 0.72);
  gradient.addColorStop(0, "rgba(2,8,11,0)");
  gradient.addColorStop(1, `rgba(1,5,8,${0.45 + intensity * 0.25})`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function drawSaleBurst(context: CanvasRenderingContext2D, x: number, y: number, width: number, time: number) {
  const progress = (time % 700) / 700;
  context.strokeStyle = `rgba(226,122,71,${1 - progress})`;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, width * 0.08 + progress * width * 0.22, 0, Math.PI * 2);
  context.stroke();
}

function drawPulse(context: CanvasRenderingContext2D, x: number, y: number, intensity: number, time: number) {
  const progress = (Math.sin(time * 0.004) + 1) / 2;
  context.strokeStyle = `rgba(110,208,189,${0.05 + progress * intensity * 0.09})`;
  context.lineWidth = 1;
  context.beginPath();
  context.arc(x, y, 110 + progress * 16, 0, Math.PI * 2);
  context.stroke();
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}
