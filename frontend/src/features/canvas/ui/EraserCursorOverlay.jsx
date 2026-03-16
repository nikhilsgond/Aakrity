// src/components/canvas/ui/EraserCursorOverlay.jsx
// ──────────────────────────────────────────────────────────────────────
// Miro-style eraser overlay — two independent visual layers on a
// SEPARATE preview canvas (never touches the main object canvas):
//
//   Brush circle  — DOM div, follows pointer. Visible while pointer
//                   is over the canvas. Never fades. Constant screen-
//                   space size regardless of zoom.
//
//   Trail stamps  — { wx, wy, createdAt } stored in WORLD coords.
//                   New stamps added on pointerMove during drag.
//                   Fast moves are interpolated so no gaps appear.
//                   Each rAF frame computes per-stamp opacity:
//                     age = now − stamp.createdAt
//                     opacity = baseAlpha × (1 − age / fadeDuration)
//                   Expired stamps are pruned. On pointerUp all
//                   stamps clear instantly. When movement stops, no
//                   new stamps are added → existing ones naturally
//                   fade away (~200 ms).
// ──────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useCallback } from 'react';
import { TOOL_TYPES } from '@shared/constants';

const ERASER_TOOLS = new Set([TOOL_TYPES.ERASER, TOOL_TYPES.OBJECT_ERASER]);

// ── Visual tuning ──
const STAMP_FADE_MS    = 200;   // per-stamp lifespan (time-based, not frames)
const STAMP_SPACING    = 3;     // min screen-px between stamps
const STAMP_BASE_ALPHA = 0.25;  // peak opacity of a fresh stamp

export default function EraserCursorOverlay({ canvasManager, activeTool, toolManager }) {
  // ── Brush circle (DOM) ──
  const cursorRef = useRef(null);
  const posRef    = useRef({ x: -9999, y: -9999, visible: false });

  // ── Trail (canvas overlay) ──
  const trailCanvasRef = useRef(null);
  const stamps         = useRef([]);          // { wx, wy, createdAt }
  const isDragging     = useRef(false);
  const loopRaf        = useRef(null);
  const lastScreenPt   = useRef(null);        // for interpolation

  const isEraser = ERASER_TOOLS.has(activeTool);

  // ── Helpers ──
  const getScreenRadius = useCallback(() => {
    const opts = toolManager?.getOptionsForTool?.(activeTool);
    return (opts?.width ?? 20) / 2;
  }, [toolManager, activeTool]);

  const isDark = () => document.documentElement.classList.contains('dark');

  const toWorld = useCallback((sx, sy) => {
    return canvasManager?.screenToWorld?.(sx, sy) ?? { x: sx, y: sy };
  }, [canvasManager]);

  const toScreen = useCallback((wx, wy) => {
    return canvasManager?.worldToScreen?.(wx, wy) ?? { x: wx, y: wy };
  }, [canvasManager]);

  // ── Brush circle paint (cheap DOM style update) ──
  const paintCursor = useCallback(() => {
    const el = cursorRef.current;
    if (!el) return;
    const { x, y, visible } = posRef.current;
    if (!visible) { el.style.display = 'none'; return; }
    const d = getScreenRadius() * 2;
    el.style.display = 'block';
    el.style.width  = `${d}px`;
    el.style.height = `${d}px`;
    el.style.left   = `${x - d / 2}px`;
    el.style.top    = `${y - d / 2}px`;
  }, [getScreenRadius]);

  // ── Trail canvas sizing ──
  const ensureCanvasSize = useCallback(() => {
    const canvas = trailCanvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement;
    if (parent) {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width  = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width  = `${w}px`;
        canvas.style.height = `${h}px`;
      }
    }
    return ctx;
  }, []);

  // ── Interpolation: add stamps along the line from prev→curr ──
  const addStampsInterpolated = useCallback((prevSx, prevSy, currSx, currSy) => {
    const dist = Math.hypot(currSx - prevSx, currSy - prevSy);
    const steps = Math.max(1, Math.floor(dist / STAMP_SPACING));
    const now = performance.now();

    for (let i = 1; i <= steps; i++) {
      const t  = i / steps;
      const sx = prevSx + (currSx - prevSx) * t;
      const sy = prevSy + (currSy - prevSy) * t;
      const w  = toWorld(sx, sy);
      stamps.current.push({ wx: w.x, wy: w.y, createdAt: now });
    }
  }, [toWorld]);

  // ── Core rAF loop — renders trail, prunes expired stamps ──
  const tick = useCallback(() => {
    const canvas = trailCanvasRef.current;
    if (!canvas) { loopRaf.current = null; return; }
    const ctx = ensureCanvasSize();
    if (!ctx) { loopRaf.current = null; return; }

    const dpr  = window.devicePixelRatio || 1;
    const cw   = canvas.width  / dpr;
    const ch   = canvas.height / dpr;
    const now  = performance.now();
    const dark = isDark();

    // Reset transform & clear entire preview layer
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    // Prune expired stamps (in-place)
    const live = stamps.current;
    let w = 0;
    for (let i = 0; i < live.length; i++) {
      if (now - live[i].createdAt < STAMP_FADE_MS) live[w++] = live[i];
    }
    live.length = w;

    // Draw trail — connected thick stroke, per-segment opacity
    if (live.length > 0) {
      const screenR  = getScreenRadius();
      const diameter = screenR * 2;

      ctx.lineCap  = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = diameter;

      if (live.length === 1) {
        const s     = live[0];
        const age   = now - s.createdAt;
        const alpha = STAMP_BASE_ALPHA * Math.max(0, 1 - age / STAMP_FADE_MS);
        if (alpha > 0.001) {
          const sp = toScreen(s.wx, s.wy);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, screenR, 0, Math.PI * 2);
          ctx.fillStyle = dark
            ? `rgba(248,113,113,${alpha})`
            : `rgba(239,68,68,${alpha})`;
          ctx.fill();
        }
      } else {
        // Draw segment-by-segment so older tail fades independently
        for (let i = 1; i < live.length; i++) {
          const prev = live[i - 1];
          const curr = live[i];

          // Use OLDER endpoint's age → tail fades first
          const age   = now - prev.createdAt;
          const alpha = STAMP_BASE_ALPHA * Math.max(0, 1 - age / STAMP_FADE_MS);
          if (alpha <= 0.001) continue;

          const a = toScreen(prev.wx, prev.wy);
          const b = toScreen(curr.wx, curr.wy);

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = dark
            ? `rgba(248,113,113,${alpha})`
            : `rgba(239,68,68,${alpha})`;
          ctx.stroke();
        }
      }
    }

    // Keep loop alive while stamps exist or user is dragging
    if (live.length > 0 || isDragging.current) {
      loopRaf.current = requestAnimationFrame(tick);
    } else {
      loopRaf.current = null;
    }
  }, [ensureCanvasSize, getScreenRadius, toScreen]);

  /** Ensure rAF loop is running */
  const ensureLoop = useCallback(() => {
    if (!loopRaf.current) loopRaf.current = requestAnimationFrame(tick);
  }, [tick]);

  /** Instantly clear all stamps + canvas */
  const clearStamps = useCallback(() => {
    stamps.current.length = 0;
    lastScreenPt.current = null;
    const canvas = trailCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  // ── Pointer event wiring ──
  useEffect(() => {
    if (!isEraser || !canvasManager?.canvas) return;
    const canvas = canvasManager.canvas;

    const toLocal = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleMove = (e) => {
      const p = toLocal(e);
      posRef.current = { x: p.x, y: p.y, visible: true };
      paintCursor();

      if (isDragging.current) {
        const last = lastScreenPt.current;
        if (last) {
          const dist = Math.hypot(p.x - last.x, p.y - last.y);
          if (dist >= STAMP_SPACING) {
            // Interpolate to fill gaps during fast movement
            addStampsInterpolated(last.x, last.y, p.x, p.y);
            lastScreenPt.current = p;
          }
        } else {
          // First move after down
          const w = toWorld(p.x, p.y);
          stamps.current.push({ wx: w.x, wy: w.y, createdAt: performance.now() });
          lastScreenPt.current = p;
        }
        ensureLoop();
      }
    };

    const handleDown = (e) => {
      clearStamps();
      isDragging.current = true;
      const p = toLocal(e);
      posRef.current = { x: p.x, y: p.y, visible: true };
      paintCursor();
      lastScreenPt.current = p;
      // Seed first stamp
      const w = toWorld(p.x, p.y);
      stamps.current.push({ wx: w.x, wy: w.y, createdAt: performance.now() });
      ensureLoop();
    };

    const handleUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      // Instant clear — no lingering trail after release
      clearStamps();
      if (loopRaf.current) { cancelAnimationFrame(loopRaf.current); loopRaf.current = null; }
    };

    const handleLeave = () => {
      posRef.current = { ...posRef.current, visible: false };
      paintCursor();
    };

    canvas.addEventListener('pointermove', handleMove);
    canvas.addEventListener('pointerdown', handleDown);
    canvas.addEventListener('pointerup',   handleUp);
    canvas.addEventListener('pointerleave', handleLeave);

    const prevCursor = canvas.style.cursor;
    canvas.style.cursor = 'none';

    return () => {
      canvas.removeEventListener('pointermove', handleMove);
      canvas.removeEventListener('pointerdown', handleDown);
      canvas.removeEventListener('pointerup',   handleUp);
      canvas.removeEventListener('pointerleave', handleLeave);
      canvas.style.cursor = prevCursor || 'default';
      if (loopRaf.current) { cancelAnimationFrame(loopRaf.current); loopRaf.current = null; }
    };
  }, [isEraser, canvasManager, paintCursor, addStampsInterpolated, toWorld, clearStamps, ensureLoop]);

  // Reset on tool switch
  useEffect(() => {
    if (!isEraser) {
      posRef.current = { x: -9999, y: -9999, visible: false };
      paintCursor();
      clearStamps();
      isDragging.current = false;
      if (loopRaf.current) { cancelAnimationFrame(loopRaf.current); loopRaf.current = null; }
    }
  }, [isEraser, paintCursor, clearStamps]);

  if (!isEraser) return null;

  return (
    <>
      {/* Trail preview canvas — separate overlay, never touches object layer */}
      <canvas
        ref={trailCanvasRef}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none',
          zIndex: 29,
        }}
      />

      {/* Brush circle — constant screen-space size, never fades */}
      <div
        ref={cursorRef}
        style={{
          position: 'absolute',
          display: 'none',
          pointerEvents: 'none',
          borderRadius: '50%',
          border: '1.5px dashed var(--eraser-cursor-border, #666)',
          backgroundColor: 'var(--eraser-cursor-bg, rgba(0,0,0,0.04))',
          zIndex: 30,
          transition: 'width 0.1s ease, height 0.1s ease',
          willChange: 'left, top',
        }}
        className="dark:[--eraser-cursor-border:#aaa] dark:[--eraser-cursor-bg:rgba(255,255,255,0.06)]"
      />
    </>
  );
}
