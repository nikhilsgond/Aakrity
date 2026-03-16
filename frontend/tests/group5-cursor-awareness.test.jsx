/**
 * Group 5 Cursor Awareness Tests
 *
 * Tests for cursor tool-awareness and cursor-freeze behavior.
 */

import { describe, it, expect, vi } from 'vitest';
import { CursorManager } from '../src/features/canvas/engine/CursorManager.js';

function makeCanvas(width = 800, height = 600) {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
    parentElement: { appendChild: vi.fn(), removeChild: vi.fn() },
  };
}

function createManager({ tool = 'select', userId = 'local' } = {}) {
  const broadcasts = [];
  const mgr = new CursorManager({
    getViewport: () => ({ zoom: 1, panX: 0, panY: 0 }),
    broadcastCursor: (wx, wy, t) => broadcasts.push({ wx, wy, tool: t }),
    getLocalUserId: () => userId,
  });
  mgr._localTool = tool;
  return { mgr, broadcasts };
}

describe('Bug #13 — Tool-aware cursor icons', () => {
  describe('setLocalTool()', () => {
    it('stores the active tool in _localTool', () => {
      const { mgr } = createManager();
      mgr.setLocalTool('pencil');
      expect(mgr._localTool).toBe('pencil');
    });

    it('triggers an immediate re-broadcast when position is known', () => {
      const { mgr, broadcasts } = createManager();
      mgr._lastCanvasWorldX = 50;
      mgr._lastCanvasWorldY = 75;
      mgr._lastBroadcastTime = -Infinity;
      mgr.setLocalTool('eraser');
      expect(broadcasts.length).toBeGreaterThan(0);
      const last = broadcasts[broadcasts.length - 1];
      expect(last.tool).toBe('eraser');
      expect(last.wx).toBe(50);
      expect(last.wy).toBe(75);
    });
  });

  describe('_throttleBroadcast() — passes tool through', () => {
    it('includes tool in broadcast payload', () => {
      const { mgr, broadcasts } = createManager();
      mgr._lastBroadcastTime = -Infinity;
      mgr._throttleBroadcast(10, 20, 'pencil');
      expect(broadcasts[0]).toMatchObject({ wx: 10, wy: 20, tool: 'pencil' });
    });
  });

  describe('updateRemoteCursor() — stores tool from userInfo', () => {
    it('stores tool in cursor entry', () => {
      const { mgr } = createManager({ userId: 'host' });
      mgr.cursors = new Map();
      mgr._createCursorEntry = (uid, info) => ({
        userId: uid, name: info.name || '', color: info.color || '#f00',
        state: info.state || 'idle', tool: info.tool || 'select',
        el: null, targetWorldX: 0, targetWorldY: 0,
        currentWorldX: 0, currentWorldY: 0, initialized: false,
        lastUpdateAt: Date.now(), _lastAppearanceKey: '',
      });
      mgr._updateCursorAppearance = () => {};
      mgr.updateRemoteCursor('remote-1', 100, 200, {
        name: 'Alice', color: '#0f0', state: 'idle', tool: 'pencil',
      });
      const cursor = mgr.cursors.get('remote-1');
      expect(cursor).toBeDefined();
      expect(cursor.tool).toBe('pencil');
    });
  });
});

describe('Bug #14 — Cursor freeze on UI hover', () => {
  it('does NOT broadcast when pointer leaves canvas', () => {
    const { mgr, broadcasts } = createManager();
    mgr._lastBroadcastTime = -Infinity;
    mgr.handlePointerLeave();
    expect(broadcasts.length).toBe(0);
  });

  it('records and respects last canvas position on move', () => {
    const { mgr } = createManager();
    const canvas = makeCanvas();
    mgr.canvas = canvas;
    mgr.handlePointerMove({ clientX: 200, clientY: 150 });
    expect(mgr._lastCanvasWorldX).toBe(200);
    expect(mgr._lastCanvasWorldY).toBe(150);
  });
});

describe('Group 5 — Integration scenarios', () => {
  it('move → leave → re-enter behaves correctly (no leave broadcast)', () => {
    const { mgr, broadcasts } = createManager();
    const canvas = makeCanvas();
    mgr.canvas = canvas;
    mgr._lastBroadcastTime = -Infinity;
    mgr.handlePointerMove({ clientX: 100, clientY: 100 });
    const countAfterMove = broadcasts.length;
    mgr.handlePointerLeave();
    expect(broadcasts.length).toBe(countAfterMove);
    mgr._lastBroadcastTime = -Infinity;
    mgr.handlePointerMove({ clientX: 200, clientY: 200 });
    expect(broadcasts.length).toBeGreaterThan(countAfterMove);
  });

  it('#13 + #14: tool is included in broadcast after re-entry', () => {
    const { mgr, broadcasts } = createManager();
    const canvas = makeCanvas();
    mgr.canvas = canvas;
    mgr._localTool = 'pencil';
    mgr._lastBroadcastTime = -Infinity;
    mgr.handlePointerMove({ clientX: 300, clientY: 300 });
    const last = broadcasts[broadcasts.length - 1];
    expect(last.tool).toBe('pencil');
  });

  it('remote cursor with tool "eraser" stores correct tool', () => {
    const { mgr } = createManager({ userId: 'host' });
    mgr._createCursorEntry = (uid, info) => ({
      userId: uid, name: info.name || 'Anon', color: info.color || '#f00',
      state: info.state || 'idle', tool: info.tool || 'select',
      el: null, targetWorldX: 0, targetWorldY: 0,
      currentWorldX: 0, currentWorldY: 0, initialized: false,
      lastUpdateAt: Date.now(), _lastAppearanceKey: '',
    });
    mgr._updateCursorAppearance = () => {};
    mgr.updateRemoteCursor('peer', 0, 0, { name: 'Peer', color: '#0f0', tool: 'eraser' });
    expect(mgr.cursors.get('peer').tool).toBe('eraser');
  });
});
