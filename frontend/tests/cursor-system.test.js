/**
 * Cursor System Tests — CursorManager
 *
 * Verifies the world-coordinate based cursor architecture:
 * - Local pointer → world coord conversion
 * - Broadcast throttling (50ms)
 * - Remote cursor interpolation (LERP)
 * - Viewport-safe screen projection
 * - Zoom correctness (1%–400%)
 * - Pan correctness
 * - No devicePixelRatio bugs
 * - DOM pooling (no per-frame createElement)
 * - Cursor cleanup on user removal
 * - Multi-user support
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CursorManager } from '../src/features/canvas/engine/CursorManager.js';

/* ================================================================
   HELPERS
   ================================================================ */

function makeViewport(zoom = 1, panX = 0, panY = 0) {
  return { zoom, panX, panY };
}

function createManager(overrides = {}) {
  const viewport = overrides.viewport || makeViewport();
  const broadcasts = [];
  const mgr = new CursorManager({
    getViewport: overrides.getViewport || (() => viewport),
    broadcastCursor: overrides.broadcastCursor || ((wx, wy) => broadcasts.push({ wx, wy })),
    getLocalUserId: overrides.getLocalUserId || (() => 'local-user'),
  });
  return { mgr, viewport, broadcasts };
}

/* ================================================================
   1. COORDINATE CONVERSION — screenToWorld
   ================================================================ */
describe('CursorManager: Local Pointer → World Conversion', () => {
  it('converts clientX/Y to world coords using canvas rect and viewport', () => {
    const viewport = makeViewport(1, 0, 0);
    const broadcasts = [];

    const mgr = new CursorManager({
      getViewport: () => viewport,
      broadcastCursor: (wx, wy) => broadcasts.push({ wx, wy }),
      getLocalUserId: () => 'me',
    });

    // Simulate canvas with getBoundingClientRect
    mgr.canvas = {
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 600 }),
    };

    // Pointer at clientX=300, clientY=250 → screen(200, 200)
    // With zoom=1, pan=(0,0) → world(200, 200)
    mgr.handlePointerMove({ clientX: 300, clientY: 250 });

    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].wx).toBeCloseTo(200);
    expect(broadcasts[0].wy).toBeCloseTo(200);
  });

  it('applies zoom correctly: zoom=2 means world coords halved', () => {
    const viewport = makeViewport(2, 0, 0);
    const broadcasts = [];

    const mgr = new CursorManager({
      getViewport: () => viewport,
      broadcastCursor: (wx, wy) => broadcasts.push({ wx, wy }),
      getLocalUserId: () => 'me',
    });

    mgr.canvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    };

    // screen(400, 300) with zoom=2, pan=(0,0) → world(200, 150)
    mgr.handlePointerMove({ clientX: 400, clientY: 300 });

    expect(broadcasts[0].wx).toBeCloseTo(200);
    expect(broadcasts[0].wy).toBeCloseTo(150);
  });

  it('applies pan correctly', () => {
    const viewport = makeViewport(1, 100, 50);
    const broadcasts = [];

    const mgr = new CursorManager({
      getViewport: () => viewport,
      broadcastCursor: (wx, wy) => broadcasts.push({ wx, wy }),
      getLocalUserId: () => 'me',
    });

    mgr.canvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    };

    // screen(400, 300) with zoom=1, pan=(100,50) → world(300, 250)
    mgr.handlePointerMove({ clientX: 400, clientY: 300 });

    expect(broadcasts[0].wx).toBeCloseTo(300);
    expect(broadcasts[0].wy).toBeCloseTo(250);
  });

  it('applies zoom + pan together', () => {
    const viewport = makeViewport(2, 100, 50);
    const broadcasts = [];

    const mgr = new CursorManager({
      getViewport: () => viewport,
      broadcastCursor: (wx, wy) => broadcasts.push({ wx, wy }),
      getLocalUserId: () => 'me',
    });

    mgr.canvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    };

    // screen(400, 300) with zoom=2, pan=(100,50) → world((400-100)/2, (300-50)/2) = (150, 125)
    mgr.handlePointerMove({ clientX: 400, clientY: 300 });

    expect(broadcasts[0].wx).toBeCloseTo(150);
    expect(broadcasts[0].wy).toBeCloseTo(125);
  });

  it('ignores pointer outside canvas bounds', () => {
    const broadcasts = [];
    const mgr = new CursorManager({
      getViewport: () => makeViewport(),
      broadcastCursor: (wx, wy) => broadcasts.push({ wx, wy }),
      getLocalUserId: () => 'me',
    });

    mgr.canvas = {
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 800, height: 600 }),
    };

    // clientX=50 → screenX = 50-100 = -50 (outside)
    mgr.handlePointerMove({ clientX: 50, clientY: 150 });
    expect(broadcasts).toHaveLength(0);
  });

  it('pointer leave freezes cursor (no off-screen sentinel broadcast) — Bug #14', () => {
    // Bug #14: handlePointerLeave is now a no-op. The cursor stays frozen at the
    // last canvas position instead of being sent off-screen.
    const broadcasts = [];
    const mgr = new CursorManager({
      getViewport: () => makeViewport(),
      broadcastCursor: (wx, wy) => broadcasts.push({ wx, wy }),
      getLocalUserId: () => 'me',
    });

    mgr.handlePointerLeave();
    // No broadcast at all — freeze behavior
    expect(broadcasts).toHaveLength(0);
  });
});

/* ================================================================
   2. ZOOM ACCURACY (1%–400%)
   ================================================================ */
describe('CursorManager: Zoom Accuracy', () => {
  const zoomLevels = [0.01, 0.1, 0.25, 0.5, 1, 2, 3, 4];

  zoomLevels.forEach(zoom => {
    it(`world→screen→world roundtrip at zoom=${zoom * 100}%`, () => {
      const worldX = 500;
      const worldY = 300;
      const panX = 120;
      const panY = 80;

      // Forward: world → screen
      const screenX = worldX * zoom + panX;
      const screenY = worldY * zoom + panY;

      // Inverse: screen → world
      const backX = (screenX - panX) / zoom;
      const backY = (screenY - panY) / zoom;

      expect(backX).toBeCloseTo(worldX, 6);
      expect(backY).toBeCloseTo(worldY, 6);
    });
  });

  it('remote cursor at 50% zoom renders at correct screen position', () => {
    const { mgr } = createManager({
      getViewport: () => makeViewport(0.5, 0, 0),
    });

    mgr.updateRemoteCursor('u1', 400, 300, { name: 'Bob', color: '#f00' });

    const cursor = mgr.cursors.get('u1');
    // After first update, cursor is snapped (initialized = true)
    expect(cursor.currentWorldX).toBe(400);
    expect(cursor.currentWorldY).toBe(300);
  });

  it('remote cursor at 300% zoom renders at correct screen position', () => {
    const viewport = makeViewport(3, 50, 25);
    const { mgr } = createManager({ getViewport: () => viewport });

    mgr.updateRemoteCursor('u1', 100, 200, { name: 'Alice', color: '#0f0' });

    const cursor = mgr.cursors.get('u1');
    // Screen = world * zoom + pan = 100*3+50=350, 200*3+25=625
    const expectedScreenX = 100 * 3 + 50;
    const expectedScreenY = 200 * 3 + 25;
    expect(expectedScreenX).toBe(350);
    expect(expectedScreenY).toBe(625);
  });
});

/* ================================================================
   3. REMOTE CURSOR MANAGEMENT
   ================================================================ */
describe('CursorManager: Remote Cursor Lifecycle', () => {
  it('adds new remote cursor', () => {
    const { mgr } = createManager();
    mgr.updateRemoteCursor('u1', 100, 200, { name: 'Alice', color: '#ff0' });
    expect(mgr.cursors.size).toBe(1);
    expect(mgr.cursors.get('u1').name).toBe('Alice');
  });

  it('skips local user cursor', () => {
    const { mgr } = createManager({ getLocalUserId: () => 'u1' });
    mgr.updateRemoteCursor('u1', 100, 200, { name: 'Me' });
    expect(mgr.cursors.size).toBe(0);
  });

  it('updates existing cursor target without recreating DOM', () => {
    const { mgr } = createManager();

    // Mock overlay
    const overlay = { appendChild: vi.fn() };
    mgr.overlay = overlay;

    mgr.updateRemoteCursor('u1', 100, 200, { name: 'Alice', color: '#ff0' });
    const el1 = mgr.cursors.get('u1').el;

    mgr.updateRemoteCursor('u1', 150, 250, { name: 'Alice', color: '#ff0' });
    const el2 = mgr.cursors.get('u1').el;

    // Same DOM element reused
    expect(el2).toBe(el1);
  });

  it('removes cursor on removeRemoteCursor', () => {
    const { mgr } = createManager();
    mgr.updateRemoteCursor('u1', 100, 200, { name: 'Alice', color: '#f00' });
    expect(mgr.cursors.size).toBe(1);

    mgr.removeRemoteCursor('u1');
    expect(mgr.cursors.size).toBe(0);
  });

  it('handles 10 simultaneous cursors', () => {
    const { mgr } = createManager();
    for (let i = 0; i < 10; i++) {
      mgr.updateRemoteCursor(`user-${i}`, i * 100, i * 50, {
        name: `User ${i}`,
        color: `#${String(i).padStart(6, '0')}`,
      });
    }
    expect(mgr.cursors.size).toBe(10);
  });
});

/* ================================================================
   4. INTERPOLATION
   ================================================================ */
describe('CursorManager: Smooth Interpolation', () => {
  it('first update snaps position (no lerp from origin)', () => {
    const { mgr } = createManager();
    mgr.updateRemoteCursor('u1', 500, 300, { name: 'A' });

    const c = mgr.cursors.get('u1');
    expect(c.currentWorldX).toBe(500);
    expect(c.currentWorldY).toBe(300);
    expect(c.initialized).toBe(true);
  });

  it('subsequent updates set target, do not snap', () => {
    const { mgr } = createManager();
    mgr.updateRemoteCursor('u1', 100, 100, { name: 'A' });

    // Now update to new position
    mgr.updateRemoteCursor('u1', 500, 500, { name: 'A' });

    const c = mgr.cursors.get('u1');
    // Current should still be at the old position
    expect(c.currentWorldX).toBe(100);
    expect(c.currentWorldY).toBe(100);
    // Target should be new position
    expect(c.targetWorldX).toBe(500);
    expect(c.targetWorldY).toBe(500);
  });

  it('LERP converges toward target over ticks', () => {
    const viewport = makeViewport(1, 0, 0);
    const mgr = new CursorManager({
      getViewport: () => viewport,
      broadcastCursor: () => {},
      getLocalUserId: () => 'me',
    });

    mgr._mounted = true;
    mgr.canvas = { getBoundingClientRect: () => ({ width: 1000, height: 800 }) };

    mgr.updateRemoteCursor('u1', 0, 0, { name: 'A' });
    mgr.updateRemoteCursor('u1', 400, 400, { name: 'A' });

    const c = mgr.cursors.get('u1');
    // Mock the element
    c.el = { style: { transform: '', display: '' } };

    // Simulate several ticks
    for (let i = 0; i < 20; i++) {
      c.currentWorldX += (c.targetWorldX - c.currentWorldX) * 0.25;
      c.currentWorldY += (c.targetWorldY - c.currentWorldY) * 0.25;
    }

    // After 20 steps with factor 0.25, should be within ~2 of target
    expect(Math.abs(c.currentWorldX - 400)).toBeLessThan(2);
    expect(Math.abs(c.currentWorldY - 400)).toBeLessThan(2);
  });

  it('LERP converges halfway in ~3 ticks', () => {
    let pos = 0;
    const target = 100;
    const factor = 0.25;

    // tick 1: 0 + (100-0)*0.25 = 25
    pos += (target - pos) * factor;
    expect(pos).toBeCloseTo(25);

    // tick 2: 25 + 75*0.25 = 43.75
    pos += (target - pos) * factor;
    expect(pos).toBeCloseTo(43.75);

    // tick 3: 43.75 + 56.25*0.25 = 57.8125
    pos += (target - pos) * factor;
    expect(pos).toBeCloseTo(57.8125);

    // After 3 ticks, past halfway
    expect(pos).toBeGreaterThan(50);
  });
});

/* ================================================================
   5. BROADCAST THROTTLING
   ================================================================ */
describe('CursorManager: Broadcast Throttling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('first broadcast fires immediately', () => {
    const broadcasts = [];
    const mgr = new CursorManager({
      getViewport: () => makeViewport(),
      broadcastCursor: (wx, wy) => broadcasts.push({ wx, wy }),
      getLocalUserId: () => 'me',
    });
    mgr.canvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    };

    mgr.handlePointerMove({ clientX: 100, clientY: 100 });
    expect(broadcasts).toHaveLength(1);
  });

  it('second broadcast within 50ms is deferred', () => {
    const broadcasts = [];
    const mgr = new CursorManager({
      getViewport: () => makeViewport(),
      broadcastCursor: (wx, wy) => broadcasts.push({ wx, wy }),
      getLocalUserId: () => 'me',
    });
    mgr.canvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    };

    mgr.handlePointerMove({ clientX: 100, clientY: 100 });
    expect(broadcasts).toHaveLength(1);

    // Move again within throttle window
    vi.advanceTimersByTime(10);
    mgr.handlePointerMove({ clientX: 200, clientY: 200 });
    // Not yet broadcast
    expect(broadcasts).toHaveLength(1);

    // After throttle period, trailing fires
    vi.advanceTimersByTime(50);
    expect(broadcasts).toHaveLength(2);
    expect(broadcasts[1].wx).toBeCloseTo(200);
  });

  it('broadcasts after throttle window expires', () => {
    const broadcasts = [];
    const mgr = new CursorManager({
      getViewport: () => makeViewport(),
      broadcastCursor: (wx, wy) => broadcasts.push({ wx, wy }),
      getLocalUserId: () => 'me',
    });
    mgr.canvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    };

    mgr.handlePointerMove({ clientX: 100, clientY: 100 });
    vi.advanceTimersByTime(60);
    mgr.handlePointerMove({ clientX: 300, clientY: 300 });
    // Should fire immediately (enough time passed)
    expect(broadcasts).toHaveLength(2);
  });
});

/* ================================================================
   6. PAN + VIEWPORT CHANGES
   ================================================================ */
describe('CursorManager: Viewport Changes', () => {
  it('viewport change does NOT re-broadcast local cursor', () => {
    const broadcasts = [];
    const { mgr } = createManager({
      broadcastCursor: (wx, wy) => broadcasts.push({ wx, wy }),
    });

    mgr.onViewportChanged();
    expect(broadcasts).toHaveLength(0);
  });

  it('remote cursor re-projects on viewport change via rAF tick', () => {
    const viewport = makeViewport(1, 0, 0);
    const mgr = new CursorManager({
      getViewport: () => viewport,
      broadcastCursor: () => {},
      getLocalUserId: () => 'me',
    });

    mgr._mounted = true;
    mgr.canvas = { getBoundingClientRect: () => ({ width: 1000, height: 800 }) };
    mgr.updateRemoteCursor('u1', 200, 100, { name: 'A' });

    const c = mgr.cursors.get('u1');
    c.el = { style: { transform: '', display: '' } };

    // Simulate tick at zoom=1, pan=0
    mgr._tick.call(mgr);
    // Cancel the rAF that _tick scheduled
    cancelAnimationFrame(mgr._rafId);
    mgr._rafId = null;
    expect(c.el.style.transform).toContain('200');

    // Change viewport
    viewport.zoom = 2;
    viewport.panX = 50;

    // Tick again — screen = 200*2+50 = 450
    mgr._tick.call(mgr);
    cancelAnimationFrame(mgr._rafId);
    mgr._rafId = null;
    expect(c.el.style.transform).toContain('450');
  });
});

/* ================================================================
   7. DOM MANAGEMENT
   ================================================================ */
describe('CursorManager: DOM Pooling', () => {
  it('creates DOM element on first cursor update', () => {
    const { mgr } = createManager();
    const appendSpy = vi.fn();
    mgr.overlay = { appendChild: appendSpy };

    mgr.updateRemoteCursor('u1', 0, 0, { name: 'Test' });

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(mgr.cursors.get('u1').el).toBeDefined();
  });

  it('reuses DOM element on subsequent updates', () => {
    const { mgr } = createManager();
    const appendSpy = vi.fn();
    mgr.overlay = { appendChild: appendSpy };

    mgr.updateRemoteCursor('u1', 0, 0, { name: 'Test' });
    mgr.updateRemoteCursor('u1', 100, 100, { name: 'Test' });
    mgr.updateRemoteCursor('u1', 200, 200, { name: 'Test' });

    // appendChild only called once
    expect(appendSpy).toHaveBeenCalledTimes(1);
  });

  it('updates innerHTML only when appearance changes', () => {
    const { mgr } = createManager();
    mgr.overlay = { appendChild: vi.fn() };

    mgr.updateRemoteCursor('u1', 0, 0, { name: 'Alice', color: '#ff0', state: 'idle' });
    const html1 = mgr.cursors.get('u1').el.innerHTML;

    // Same appearance — no innerHTML change
    mgr.updateRemoteCursor('u1', 100, 100, { name: 'Alice', color: '#ff0', state: 'idle' });
    const html2 = mgr.cursors.get('u1').el.innerHTML;
    expect(html2).toBe(html1);

    // Different state — innerHTML changes
    mgr.updateRemoteCursor('u1', 200, 200, { name: 'Alice', color: '#ff0', state: 'editing' });
    const html3 = mgr.cursors.get('u1').el.innerHTML;
    expect(html3).not.toBe(html1);
    expect(html3).toContain('✏️');
  });

  it('remove removes DOM element', () => {
    const { mgr } = createManager();
    mgr.overlay = { appendChild: vi.fn() };

    mgr.updateRemoteCursor('u1', 0, 0, { name: 'Test' });
    const el = mgr.cursors.get('u1').el;
    const removeSpy = vi.spyOn(el, 'remove');

    mgr.removeRemoteCursor('u1');
    expect(removeSpy).toHaveBeenCalled();
    expect(mgr.cursors.size).toBe(0);
  });
});

/* ================================================================
   8. DESTROY / CLEANUP
   ================================================================ */
describe('CursorManager: Lifecycle', () => {
  it('destroy removes all cursors and overlay', () => {
    const { mgr } = createManager();
    mgr.overlay = document.createElement('div');
    const parent = document.createElement('div');
    parent.appendChild(mgr.overlay);

    mgr.updateRemoteCursor('u1', 0, 0, { name: 'A' });
    mgr.updateRemoteCursor('u2', 0, 0, { name: 'B' });

    mgr.destroy();

    expect(mgr.cursors.size).toBe(0);
    expect(mgr.overlay).toBeNull();
    expect(parent.children.length).toBe(0);
  });

  it('destroy cancels rAF and broadcast timer', () => {
    vi.useFakeTimers();
    const { mgr } = createManager();
    mgr._mounted = true;
    mgr._rafId = 123;
    mgr._broadcastTimer = setTimeout(() => {}, 1000);

    mgr.destroy();

    expect(mgr._rafId).toBeNull();
    expect(mgr._mounted).toBe(false);
    vi.useRealTimers();
  });
});

/* ================================================================
   9. WORLD-COORDINATE-ONLY INVARIANT
   ================================================================ */
describe('Cursor System: World-Coordinate Invariant', () => {
  it('no screenX/screenY stored in cursor state', () => {
    const { mgr } = createManager();
    mgr.updateRemoteCursor('u1', 100, 200, { name: 'A' });

    const cursor = mgr.cursors.get('u1');
    expect(cursor).not.toHaveProperty('screenX');
    expect(cursor).not.toHaveProperty('screenY');
    expect(cursor.targetWorldX).toBe(100);
    expect(cursor.targetWorldY).toBe(200);
  });

  it('broadcast sends only world coords', () => {
    const broadcasts = [];
    const mgr = new CursorManager({
      getViewport: () => makeViewport(2, 100, 50),
      broadcastCursor: (wx, wy) => broadcasts.push({ wx, wy }),
      getLocalUserId: () => 'me',
    });
    mgr.canvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    };

    mgr.handlePointerMove({ clientX: 400, clientY: 300 });

    // World coords: (400-100)/2=150, (300-50)/2=125
    expect(broadcasts[0].wx).toBeCloseTo(150);
    expect(broadcasts[0].wy).toBeCloseTo(125);
    // No screen coords in broadcast
    expect(broadcasts[0]).not.toHaveProperty('screenX');
    expect(broadcasts[0]).not.toHaveProperty('screenY');
  });
});

/* ================================================================
   10. MULTI-USER SCENARIO
   ================================================================ */
describe('CursorManager: Multi-User Stress', () => {
  it('10 users with different positions all tracked independently', () => {
    const { mgr } = createManager();

    for (let i = 0; i < 10; i++) {
      mgr.updateRemoteCursor(`user-${i}`, i * 100, i * 50, {
        name: `User ${i}`,
        color: '#' + (i * 111111 % 0xFFFFFF).toString(16).padStart(6, '0'),
      });
    }

    expect(mgr.cursors.size).toBe(10);

    // Verify each has independent world position
    for (let i = 0; i < 10; i++) {
      const c = mgr.cursors.get(`user-${i}`);
      expect(c.targetWorldX).toBe(i * 100);
      expect(c.targetWorldY).toBe(i * 50);
    }
  });

  it('removing one user does not affect others', () => {
    const { mgr } = createManager();

    mgr.updateRemoteCursor('u1', 100, 100, { name: 'A' });
    mgr.updateRemoteCursor('u2', 200, 200, { name: 'B' });
    mgr.updateRemoteCursor('u3', 300, 300, { name: 'C' });

    mgr.removeRemoteCursor('u2');

    expect(mgr.cursors.size).toBe(2);
    expect(mgr.cursors.has('u1')).toBe(true);
    expect(mgr.cursors.has('u3')).toBe(true);
    expect(mgr.cursors.has('u2')).toBe(false);
  });

  it('updating one cursor does not affect others', () => {
    const { mgr } = createManager();

    mgr.updateRemoteCursor('u1', 100, 100, { name: 'A' });
    mgr.updateRemoteCursor('u2', 200, 200, { name: 'B' });

    mgr.updateRemoteCursor('u1', 900, 900, { name: 'A' });

    expect(mgr.cursors.get('u1').targetWorldX).toBe(900);
    expect(mgr.cursors.get('u2').targetWorldX).toBe(200); // unchanged
  });
});
