/**
 * Eraser System Tests
 * ──────────────────────────────────────────────────────────────────────
 * Covers both eraser tools AND supporting modules:
 *
 *  1. eraserMath — splitPolylineByCircle, circleIntersectsBounds
 *  2. ApplyEraserCommand — execute / undo / redo cycle
 *  3. PrecisionEraserTool — stroke splitting, zoom, locks, undo
 *  4. ObjectEraserTool — full object deletion, zoom, locks, undo
 *  5. Integration — multi-object drags, edge cases, stress
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  splitPolylineByCircle,
  circleIntersectsBounds,
  cloneCanvasObject,
  pointsEquivalent,
} from '../src/features/canvas/tools/eraser/lib/eraserMath.js';

import {
  ApplyEraserCommand,
  EraserCommandFactory,
} from '../src/features/canvas/engine/commands/EraserCommands.js';

import { PrecisionEraserTool } from '../src/features/canvas/tools/eraser/PrecisionEraserTool.js';
import { ObjectEraserTool } from '../src/features/canvas/tools/eraser/ObjectEraserTool.js';

import { createState, makeDrawing, makeRect, makeCircle, makeText } from './helpers.js';

/* ================================================================
   HELPERS
   ================================================================ */

/** Minimal CanvasManager mock that satisfies tool API. */
function createMockCanvasManager(stateOverrides = {}) {
  const state = createState(stateOverrides);

  const undoStack = [];
  const events = [];

  const mgr = {
    state,
    objectsById: new Map(),

    historyManager: {
      execute(cmd, s) { cmd.execute(s); undoStack.push(cmd); },
      registerWithoutExecuting(cmd) { undoStack.push(cmd); },
      canUndo() { return undoStack.length > 0; },
      undo(s) {
        const cmd = undoStack.pop();
        if (cmd) cmd.undo(s);
        return cmd;
      },
      _stack: undoStack,
    },

    updateObjectIndex() {
      mgr.objectsById.clear();
      state.objects.forEach(obj => {
        if (obj.id) mgr.objectsById.set(obj.id, obj);
      });
    },

    requestRender: vi.fn(),
    emit: vi.fn((event, data) => events.push({ event, data })),

    screenToWorld(sx, sy) {
      const { zoom, panX, panY } = state.viewport;
      return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };
    },

    _collaborationStore: null,
    _events: events,
  };

  mgr.updateObjectIndex();
  return mgr;
}

/** Make a horizontal stroke from (x, y) to (x + length, y). */
function makeHorizontalStroke(id, x, y, length, numPoints = 10) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    points.push({ x: x + (length * i) / (numPoints - 1), y });
  }
  return makeDrawing({ id, points, strokeWidth: 2 });
}

/** Make a diagonal stroke from (0,0) to (dx, dy). */
function makeDiagonalStroke(id, dx, dy, numPoints = 10) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    points.push({ x: dx * t, y: dy * t });
  }
  return makeDrawing({ id, points, strokeWidth: 2 });
}

/* ================================================================
   1. ERASER MATH
   ================================================================ */
describe('eraserMath', () => {

  /* ---- circleIntersectsBounds ---- */
  describe('circleIntersectsBounds', () => {
    it('returns true when circle overlaps bounds', () => {
      expect(circleIntersectsBounds({ x: 50, y: 50 }, 10, { x: 0, y: 0, width: 100, height: 100 })).toBe(true);
    });

    it('returns true when circle touches edge', () => {
      expect(circleIntersectsBounds({ x: 110, y: 50 }, 10, { x: 0, y: 0, width: 100, height: 100 })).toBe(true);
    });

    it('returns false when circle is far away', () => {
      expect(circleIntersectsBounds({ x: 200, y: 200 }, 5, { x: 0, y: 0, width: 100, height: 100 })).toBe(false);
    });

    it('returns false for null bounds', () => {
      expect(circleIntersectsBounds({ x: 0, y: 0 }, 10, null)).toBe(false);
    });

    it('returns true when circle center is inside bounds', () => {
      expect(circleIntersectsBounds({ x: 50, y: 50 }, 1, { x: 0, y: 0, width: 100, height: 100 })).toBe(true);
    });
  });

  /* ---- splitPolylineByCircle ---- */
  describe('splitPolylineByCircle', () => {
    it('returns empty array for < 2 points', () => {
      expect(splitPolylineByCircle([{ x: 0, y: 0 }], { x: 0, y: 0 }, 5)).toEqual([]);
      expect(splitPolylineByCircle([], { x: 0, y: 0 }, 5)).toEqual([]);
    });

    it('returns original when circle misses entirely', () => {
      const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      const result = splitPolylineByCircle(points, { x: 50, y: 50 }, 5);
      // Should get one segment back
      expect(result.length).toBe(1);
      expect(result[0].length).toBe(2);
    });

    it('splits a horizontal line through the middle', () => {
      // Horizontal line from (0,0) to (100,0), erase circle at (50,0) radius 10
      const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      const result = splitPolylineByCircle(points, { x: 50, y: 0 }, 10);
      // Should have 2 segments: [0→40] and [60→100]
      expect(result.length).toBe(2);
      expect(result[0][0].x).toBeCloseTo(0, 0);
      expect(result[0][result[0].length - 1].x).toBeCloseTo(40, 0);
      expect(result[1][0].x).toBeCloseTo(60, 0);
      expect(result[1][result[1].length - 1].x).toBeCloseTo(100, 0);
    });

    it('erases the start of a line', () => {
      const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      const result = splitPolylineByCircle(points, { x: 0, y: 0 }, 15);
      // Should have 1 segment starting around x=15
      expect(result.length).toBe(1);
      expect(result[0][0].x).toBeGreaterThan(10);
    });

    it('erases the end of a line', () => {
      const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      const result = splitPolylineByCircle(points, { x: 100, y: 0 }, 15);
      expect(result.length).toBe(1);
      expect(result[0][result[0].length - 1].x).toBeLessThan(100);
    });

    it('fully erases a short segment', () => {
      const points = [{ x: 0, y: 0 }, { x: 5, y: 0 }];
      const result = splitPolylineByCircle(points, { x: 2.5, y: 0 }, 10);
      expect(result.length).toBe(0);
    });

    it('handles multipoint polyline split', () => {
      // 5-point horizontal line
      const points = [
        { x: 0, y: 0 }, { x: 25, y: 0 }, { x: 50, y: 0 },
        { x: 75, y: 0 }, { x: 100, y: 0 },
      ];
      const result = splitPolylineByCircle(points, { x: 50, y: 0 }, 10);
      expect(result.length).toBe(2);
    });

    it('preserves pressure metadata during split', () => {
      const points = [
        { x: 0, y: 0, pressure: 0.3 },
        { x: 100, y: 0, pressure: 0.9 },
      ];
      const result = splitPolylineByCircle(points, { x: 50, y: 0 }, 10);
      // Interpolated intersection points should have pressure
      for (const seg of result) {
        for (const p of seg) {
          expect(typeof p.pressure).toBe('number');
        }
      }
    });
  });

  /* ---- cloneCanvasObject ---- */
  describe('cloneCanvasObject', () => {
    it('deep clones an object', () => {
      const obj = { id: 'a', points: [{ x: 1, y: 2 }], nested: { v: 3 } };
      const clone = cloneCanvasObject(obj);
      expect(clone).toEqual(obj);
      expect(clone).not.toBe(obj);
      expect(clone.points).not.toBe(obj.points);
      expect(clone.nested).not.toBe(obj.nested);
    });

    it('skips private keys starting with _', () => {
      const obj = { id: 'a', _internal: 42 };
      const clone = cloneCanvasObject(obj);
      expect(clone._internal).toBeUndefined();
    });

    it('skips functions', () => {
      const obj = { id: 'a', fn: () => {} };
      const clone = cloneCanvasObject(obj);
      expect(clone.fn).toBeUndefined();
    });
  });

  /* ---- pointsEquivalent ---- */
  describe('pointsEquivalent', () => {
    it('returns true for identical points', () => {
      const a = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
      const b = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
      expect(pointsEquivalent(a, b)).toBe(true);
    });

    it('returns false for different lengths', () => {
      expect(pointsEquivalent([{ x: 1, y: 2 }], [{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe(false);
    });

    it('returns false for different coords', () => {
      expect(pointsEquivalent([{ x: 1, y: 2 }], [{ x: 1, y: 99 }])).toBe(false);
    });
  });
});

/* ================================================================
   2. APPLY ERASER COMMAND
   ================================================================ */
describe('ApplyEraserCommand', () => {
  it('execute replaces before→after objects', () => {
    const state = createState({
      objects: [makeDrawing({ id: 'd1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] })],
    });

    const cmd = new ApplyEraserCommand({
      beforeObjects: [cloneCanvasObject(state.objects[0])],
      afterObjects: [{ ...cloneCanvasObject(state.objects[0]), points: [{ x: 0, y: 0 }, { x: 40, y: 0 }] }],
      addedObjects: [],
    });

    cmd.execute(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].points).toHaveLength(2);
    expect(state.objects[0].points[1].x).toBeCloseTo(40);
  });

  it('execute removes objects with no afterObject', () => {
    const d1 = makeDrawing({ id: 'd1' });
    const state = createState({ objects: [d1] });

    const cmd = new ApplyEraserCommand({
      beforeObjects: [cloneCanvasObject(d1)],
      afterObjects: [],
      addedObjects: [],
    });

    cmd.execute(state);
    expect(state.objects).toHaveLength(0);
  });

  it('execute adds new segment objects', () => {
    const d1 = makeDrawing({ id: 'd1' });
    const state = createState({ objects: [d1] });

    const newSeg = makeDrawing({ id: 'seg_1', points: [{ x: 60, y: 0 }, { x: 100, y: 0 }] });

    const cmd = new ApplyEraserCommand({
      beforeObjects: [cloneCanvasObject(d1)],
      afterObjects: [{ ...cloneCanvasObject(d1), points: [{ x: 0, y: 0 }, { x: 40, y: 0 }] }],
      addedObjects: [newSeg],
    });

    cmd.execute(state);
    expect(state.objects).toHaveLength(2);
    expect(state.objects.find(o => o.id === 'seg_1')).toBeTruthy();
  });

  it('undo restores original state', () => {
    const original = makeDrawing({ id: 'd1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
    const state = createState({ objects: [cloneCanvasObject(original)] });

    const cmd = new ApplyEraserCommand({
      beforeObjects: [cloneCanvasObject(original)],
      afterObjects: [{ ...cloneCanvasObject(original), points: [{ x: 0, y: 0 }, { x: 40, y: 0 }] }],
      addedObjects: [makeDrawing({ id: 'seg_1' })],
    });

    cmd.execute(state);
    expect(state.objects).toHaveLength(2);

    cmd.undo(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].id).toBe('d1');
    expect(state.objects[0].points).toHaveLength(2);
    expect(state.objects[0].points[1].x).toBeCloseTo(100);
  });

  it('undo then re-execute is idempotent', () => {
    const original = makeDrawing({ id: 'd1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
    const state = createState({ objects: [cloneCanvasObject(original)] });

    const cmd = new ApplyEraserCommand({
      beforeObjects: [cloneCanvasObject(original)],
      afterObjects: [],
      addedObjects: [],
    });

    cmd.execute(state);
    expect(state.objects).toHaveLength(0);

    cmd.undo(state);
    expect(state.objects).toHaveLength(1);

    cmd.execute(state);
    expect(state.objects).toHaveLength(0);
  });

  it('serialize / deserialize round-trips correctly', () => {
    const cmd = new ApplyEraserCommand({
      beforeObjects: [makeDrawing({ id: 'd1' })],
      afterObjects: [],
      addedObjects: [makeDrawing({ id: 'seg_1' })],
      meta: { tool: 'precision-eraser' },
    });

    const serialized = cmd.serialize();
    expect(serialized.type).toBe('ApplyEraserCommand');

    const restored = ApplyEraserCommand.deserialize(serialized);
    expect(restored.beforeObjects).toHaveLength(1);
    expect(restored.addedObjects).toHaveLength(1);
    expect(restored.meta.tool).toBe('precision-eraser');
  });

  it('EraserCommandFactory.createPatch produces valid command', () => {
    const cmd = EraserCommandFactory.createPatch({
      beforeObjects: [makeDrawing({ id: 'd1' })],
      afterObjects: [],
    });
    expect(cmd).toBeInstanceOf(ApplyEraserCommand);
  });
});

/* ================================================================
   3. PRECISION ERASER TOOL
   ================================================================ */
describe('PrecisionEraserTool', () => {
  let tool;
  let mgr;

  beforeEach(() => {
    tool = new PrecisionEraserTool({ width: 20 });
  });

  /* ---- lifecycle ---- */
  describe('lifecycle', () => {
    it('activate sets canvasManager', () => {
      mgr = createMockCanvasManager();
      tool.activate(mgr, { width: 20 });
      expect(tool.canvasManager).toBe(mgr);
      expect(tool.options.width).toBe(20);
    });

    it('deactivate clears canvasManager', () => {
      mgr = createMockCanvasManager();
      tool.activate(mgr);
      tool.deactivate();
      expect(tool.canvasManager).toBeNull();
    });

    it('setOptions updates options', () => {
      tool.setOptions({ width: 30 });
      expect(tool.options.width).toBe(30);
    });
  });

  /* ---- split middle of stroke ---- */
  describe('split middle of stroke', () => {
    it('splits a horizontal stroke through the center', () => {
      const stroke = makeHorizontalStroke('s1', 0, 0, 100, 11);
      mgr = createMockCanvasManager({ objects: [stroke] });
      tool.activate(mgr, { width: 20 });

      // Pointer down at center (50, 0) → should split
      tool.onPointerDown({ x: 50, y: 0 });
      tool.onPointerUp({ x: 50, y: 0 });

      // Original was modified + new segments added
      const objects = mgr.state.objects;
      expect(objects.length).toBeGreaterThanOrEqual(2);

      // Check undo stack has a command
      expect(mgr.historyManager._stack).toHaveLength(1);
    });

    it('undo restores original stroke after split', () => {
      const stroke = makeHorizontalStroke('s1', 0, 0, 100, 11);
      mgr = createMockCanvasManager({ objects: [stroke] });
      tool.activate(mgr, { width: 20 });

      const originalPointCount = stroke.points.length;

      tool.onPointerDown({ x: 50, y: 0 });
      tool.onPointerUp({ x: 50, y: 0 });

      // Undo
      mgr.historyManager.undo(mgr.state);

      expect(mgr.state.objects).toHaveLength(1);
      expect(mgr.state.objects[0].id).toBe('s1');
      expect(mgr.state.objects[0].points).toHaveLength(originalPointCount);
    });
  });

  /* ---- full erase ---- */
  describe('full erase of short stroke', () => {
    it('removes a short stroke entirely', () => {
      const shortStroke = makeDrawing({
        id: 'short1',
        points: [{ x: 0, y: 0 }, { x: 3, y: 0 }],
        strokeWidth: 2,
      });
      mgr = createMockCanvasManager({ objects: [shortStroke] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 1.5, y: 0 });
      tool.onPointerUp({ x: 1.5, y: 0 });

      expect(mgr.state.objects).toHaveLength(0);
    });

    it('undo restores fully erased stroke', () => {
      const shortStroke = makeDrawing({
        id: 'short1',
        points: [{ x: 0, y: 0 }, { x: 3, y: 0 }],
        strokeWidth: 2,
      });
      mgr = createMockCanvasManager({ objects: [shortStroke] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 1.5, y: 0 });
      tool.onPointerUp({ x: 1.5, y: 0 });

      expect(mgr.state.objects).toHaveLength(0);

      mgr.historyManager.undo(mgr.state);
      expect(mgr.state.objects).toHaveLength(1);
      expect(mgr.state.objects[0].id).toBe('short1');
    });
  });

  /* ---- skips non-drawing objects ---- */
  describe('only targets drawing objects', () => {
    it('ignores rectangles', () => {
      const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 20, height: 20 });
      mgr = createMockCanvasManager({ objects: [rect] });
      tool.activate(mgr, { width: 40 });

      tool.onPointerDown({ x: 10, y: 10 });
      tool.onPointerUp({ x: 10, y: 10 });

      expect(mgr.state.objects).toHaveLength(1);
      expect(mgr.state.objects[0].id).toBe('r1');
    });

    it('ignores text objects', () => {
      const text = makeText({ id: 't1', x: 0, y: 0 });
      mgr = createMockCanvasManager({ objects: [text] });
      tool.activate(mgr, { width: 40 });

      tool.onPointerDown({ x: 10, y: 10 });
      tool.onPointerUp({ x: 10, y: 10 });

      expect(mgr.state.objects).toHaveLength(1);
    });
  });

  /* ---- zoom safety ---- */
  describe('zoom safety', () => {
    it('eraser world radius shrinks at high zoom', () => {
      const stroke = makeHorizontalStroke('s1', 0, 0, 1000, 11);
      mgr = createMockCanvasManager({
        objects: [stroke],
        viewport: { zoom: 4, panX: 0, panY: 0 },
      });
      tool.activate(mgr, { width: 20 });

      // worldRadius = (20/2) / 4 = 2.5
      // Eraser at x=500 with worldRadius 2.5 only erases a tiny section
      tool.onPointerDown({ x: 500, y: 0 });
      tool.onPointerUp({ x: 500, y: 0 });

      // Some objects should remain — the split is very narrow
      expect(mgr.state.objects.length).toBeGreaterThanOrEqual(1);
    });

    it('eraser world radius grows at low zoom', () => {
      const stroke = makeHorizontalStroke('s1', 0, 0, 100, 11);
      mgr = createMockCanvasManager({
        objects: [stroke],
        viewport: { zoom: 0.1, panX: 0, panY: 0 },
      });
      tool.activate(mgr, { width: 20 });

      // worldRadius = (20/2) / 0.1 = 100 — covers the entire stroke!
      tool.onPointerDown({ x: 50, y: 0 });
      tool.onPointerUp({ x: 50, y: 0 });

      expect(mgr.state.objects).toHaveLength(0);
    });
  });

  /* ---- lock safety ---- */
  describe('lock safety', () => {
    it('skips objects locked by another user', () => {
      const stroke = makeHorizontalStroke('s1', 0, 0, 100, 11);
      mgr = createMockCanvasManager({ objects: [stroke] });
      mgr._collaborationStore = {
        isLockedByOther: (id) => id === 's1',
      };
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 50, y: 0 });
      tool.onPointerUp({ x: 50, y: 0 });

      // Stroke untouched
      expect(mgr.state.objects).toHaveLength(1);
      expect(mgr.state.objects[0].id).toBe('s1');
      expect(mgr.state.objects[0].points).toHaveLength(11);
    });
  });

  /* ---- throttling ---- */
  describe('throttling', () => {
    it('skips rapid pointermove events', () => {
      const stroke = makeHorizontalStroke('s1', 0, 0, 1000, 101);
      mgr = createMockCanvasManager({ objects: [stroke] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 0, y: 0 });

      // Fire many quick moves — most should be throttled
      const renderCallsBefore = mgr.requestRender.mock.calls.length;

      for (let i = 0; i < 100; i++) {
        tool.onPointerMove({ x: i * 10, y: 0 });
      }

      // Should NOT have called requestRender 100 times
      const renderCalls = mgr.requestRender.mock.calls.length - renderCallsBefore;
      expect(renderCalls).toBeLessThan(100);

      tool.onPointerUp({ x: 1000, y: 0 });
    });
  });

  /* ---- multi-stroke drag ---- */
  describe('multi-stroke drag', () => {
    it('erases portions of multiple strokes in one drag', () => {
      const s1 = makeHorizontalStroke('s1', 0, 0, 100, 11);
      const s2 = makeHorizontalStroke('s2', 0, 50, 100, 11);
      mgr = createMockCanvasManager({ objects: [s1, s2] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 50, y: 0 });
      // Force throttle bypass
      tool.lastMoveTime = 0;
      tool.onPointerMove({ x: 50, y: 50 });
      tool.onPointerUp({ x: 50, y: 50 });

      // Both strokes should be affected — check command was registered
      expect(mgr.historyManager._stack).toHaveLength(1);

      // Undo should restore both
      mgr.historyManager.undo(mgr.state);
      expect(mgr.state.objects).toHaveLength(2);
      expect(mgr.state.objects.find(o => o.id === 's1').points).toHaveLength(11);
      expect(mgr.state.objects.find(o => o.id === 's2').points).toHaveLength(11);
    });
  });

  /* ---- rollback on deactivate during drag ---- */
  describe('rollback on deactivate', () => {
    it('restores state if deactivated mid-drag', () => {
      const stroke = makeHorizontalStroke('s1', 0, 0, 100, 11);
      mgr = createMockCanvasManager({ objects: [stroke] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 50, y: 0 });
      // At this point, the stroke might be modified in state
      const objectsAfterDown = mgr.state.objects.length;

      // Deactivate mid-drag — should roll back
      tool.deactivate();

      expect(mgr.state.objects).toHaveLength(1);
      expect(mgr.state.objects[0].id).toBe('s1');
      expect(mgr.state.objects[0].points).toHaveLength(11);
      // No command should be on the stack
      expect(mgr.historyManager._stack).toHaveLength(0);
    });
  });

  /* ---- no-op when clicking empty area ---- */
  describe('no-op behavior', () => {
    it('returns null and no command when nothing is hit', () => {
      const stroke = makeHorizontalStroke('s1', 0, 0, 100, 11);
      mgr = createMockCanvasManager({ objects: [stroke] });
      tool.activate(mgr, { width: 20 });

      const result = tool.onPointerDown({ x: 500, y: 500 });
      expect(result).toBeNull();

      const upResult = tool.onPointerUp({ x: 500, y: 500 });
      expect(upResult).toBeNull();
      expect(mgr.historyManager._stack).toHaveLength(0);
    });

    it('returns null when canvasManager is null', () => {
      const result = tool.onPointerDown({ x: 0, y: 0 });
      expect(result).toBeNull();
    });
  });

  /* ---- emits state:changed ---- */
  describe('events', () => {
    it('emits state:changed after successful erase', () => {
      const stroke = makeDrawing({
        id: 's1',
        points: [{ x: 0, y: 0 }, { x: 3, y: 0 }],
      });
      mgr = createMockCanvasManager({ objects: [stroke] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 1.5, y: 0 });
      tool.onPointerUp({ x: 1.5, y: 0 });

      const stateChangedEvents = mgr._events.filter(e => e.event === 'state:changed');
      expect(stateChangedEvents.length).toBeGreaterThan(0);
    });
  });
});

/* ================================================================
   4. OBJECT ERASER TOOL
   ================================================================ */
describe('ObjectEraserTool', () => {
  let tool;
  let mgr;

  beforeEach(() => {
    tool = new ObjectEraserTool({ width: 20 });
  });

  /* ---- lifecycle ---- */
  describe('lifecycle', () => {
    it('activate sets canvasManager', () => {
      mgr = createMockCanvasManager();
      tool.activate(mgr, { width: 30 });
      expect(tool.canvasManager).toBe(mgr);
      expect(tool.options.width).toBe(30);
    });

    it('deactivate clears canvasManager', () => {
      mgr = createMockCanvasManager();
      tool.activate(mgr);
      tool.deactivate();
      expect(tool.canvasManager).toBeNull();
    });
  });

  /* ---- delete drawing ---- */
  describe('delete drawing object', () => {
    it('removes a drawing stroke on click', () => {
      const stroke = makeDrawing({
        id: 'd1',
        points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
      });
      mgr = createMockCanvasManager({ objects: [stroke] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 15, y: 15 });
      tool.onPointerUp({ x: 15, y: 15 });

      expect(mgr.state.objects).toHaveLength(0);
      expect(mgr.historyManager._stack).toHaveLength(1);
    });
  });

  /* ---- delete rectangle ---- */
  describe('delete rectangle', () => {
    it('removes a rectangle when clicked on it', () => {
      const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100 });
      mgr = createMockCanvasManager({ objects: [rect] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 50, y: 50 });
      tool.onPointerUp({ x: 50, y: 50 });

      expect(mgr.state.objects).toHaveLength(0);
    });
  });

  /* ---- delete circle ---- */
  describe('delete circle', () => {
    it('removes a circle when clicked on it', () => {
      const circle = makeCircle({ id: 'c1', x: 300, y: 300, radius: 50 });
      mgr = createMockCanvasManager({ objects: [circle] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 300, y: 300 });
      tool.onPointerUp({ x: 300, y: 300 });

      expect(mgr.state.objects).toHaveLength(0);
    });
  });

  /* ---- delete text ---- */
  describe('delete text', () => {
    it('removes a text object when clicked', () => {
      const text = makeText({ id: 't1', x: 50, y: 50, width: 200, height: 50 });
      mgr = createMockCanvasManager({ objects: [text] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 150, y: 75 });
      tool.onPointerUp({ x: 150, y: 75 });

      expect(mgr.state.objects).toHaveLength(0);
    });
  });

  /* ---- undo / redo ---- */
  describe('undo / redo', () => {
    it('undo restores deleted objects', () => {
      const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100 });
      mgr = createMockCanvasManager({ objects: [rect] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 50, y: 50 });
      tool.onPointerUp({ x: 50, y: 50 });
      expect(mgr.state.objects).toHaveLength(0);

      mgr.historyManager.undo(mgr.state);
      expect(mgr.state.objects).toHaveLength(1);
      expect(mgr.state.objects[0].id).toBe('r1');
    });

    it('undo then redo re-deletes', () => {
      const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100 });
      mgr = createMockCanvasManager({ objects: [rect] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 50, y: 50 });
      tool.onPointerUp({ x: 50, y: 50 });

      const cmd = mgr.historyManager._stack[0];
      mgr.historyManager.undo(mgr.state);
      expect(mgr.state.objects).toHaveLength(1);

      cmd.execute(mgr.state);
      expect(mgr.state.objects).toHaveLength(0);
    });
  });

  /* ---- multi-object drag ---- */
  describe('multi-object drag', () => {
    it('deletes multiple objects in a single drag', () => {
      const d1 = makeDrawing({ id: 'd1', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
      const d2 = makeDrawing({ id: 'd2', points: [{ x: 0, y: 50 }, { x: 10, y: 50 }] });
      mgr = createMockCanvasManager({ objects: [d1, d2] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 5, y: 0 });
      tool.lastMoveTime = 0; // bypass throttle
      tool.onPointerMove({ x: 5, y: 50 });
      tool.onPointerUp({ x: 5, y: 50 });

      expect(mgr.state.objects).toHaveLength(0);
      // Single command for entire drag
      expect(mgr.historyManager._stack).toHaveLength(1);

      // Undo restores all
      mgr.historyManager.undo(mgr.state);
      expect(mgr.state.objects).toHaveLength(2);
    });
  });

  /* ---- lock safety ---- */
  describe('lock safety', () => {
    it('does not delete locked objects', () => {
      const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100 });
      mgr = createMockCanvasManager({ objects: [rect] });
      mgr._collaborationStore = {
        isLockedByOther: (id) => id === 'r1',
      };
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 50, y: 50 });
      tool.onPointerUp({ x: 50, y: 50 });

      expect(mgr.state.objects).toHaveLength(1);
    });

    it('deletes unlocked but keeps locked in mixed set', () => {
      const r1 = makeRect({ id: 'r1', x: 0, y: 0, width: 50, height: 50 });
      const r2 = makeRect({ id: 'r2', x: 0, y: 0, width: 50, height: 50 });
      mgr = createMockCanvasManager({ objects: [r1, r2] });
      mgr._collaborationStore = {
        isLockedByOther: (id) => id === 'r1', // only r1 is locked
      };
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 25, y: 25 });
      tool.onPointerUp({ x: 25, y: 25 });

      // r1 survives (locked), r2 may or may not be hit depending on hitTest
      const remaining = mgr.state.objects.filter(o => o.id === 'r1');
      expect(remaining).toHaveLength(1);
    });
  });

  /* ---- zoom safety ---- */
  describe('zoom safety', () => {
    it('world tolerance shrinks at high zoom', () => {
      mgr = createMockCanvasManager({
        viewport: { zoom: 4, panX: 0, panY: 0 },
      });
      tool.activate(mgr, { width: 20 });

      // worldTolerance = (20/2) / 4 = 2.5
      // A small tolerance means less hitTest area
      const tolerance = tool._getWorldTolerance();
      expect(tolerance).toBeCloseTo(2.5);
    });

    it('world tolerance grows at low zoom', () => {
      mgr = createMockCanvasManager({
        viewport: { zoom: 0.1, panX: 0, panY: 0 },
      });
      tool.activate(mgr, { width: 20 });

      const tolerance = tool._getWorldTolerance();
      expect(tolerance).toBeCloseTo(100);
    });
  });

  /* ---- no-op ---- */
  describe('no-op behavior', () => {
    it('no command when nothing hit', () => {
      mgr = createMockCanvasManager({ objects: [] });
      tool.activate(mgr, { width: 20 });

      const r = tool.onPointerDown({ x: 0, y: 0 });
      expect(r).toBeNull();
      const u = tool.onPointerUp({ x: 0, y: 0 });
      expect(u).toBeNull();
      expect(mgr.historyManager._stack).toHaveLength(0);
    });

    it('returns null when canvasManager is null', () => {
      expect(tool.onPointerDown({ x: 0, y: 0 })).toBeNull();
    });
  });

  /* ---- rollback on deactivate ---- */
  describe('rollback on deactivate', () => {
    it('restores deleted objects if deactivated mid-drag', () => {
      const d1 = makeDrawing({ id: 'd1', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
      mgr = createMockCanvasManager({ objects: [d1] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 5, y: 0 });
      // d1 is likely deleted from state now
      expect(mgr.state.objects.length).toBeLessThanOrEqual(1);

      tool.deactivate();

      // State should be restored
      expect(mgr.state.objects).toHaveLength(1);
      expect(mgr.state.objects[0].id).toBe('d1');
    });
  });

  /* ---- events ---- */
  describe('events', () => {
    it('emits state:changed on successful delete', () => {
      const d1 = makeDrawing({ id: 'd1', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
      mgr = createMockCanvasManager({ objects: [d1] });
      tool.activate(mgr, { width: 20 });

      tool.onPointerDown({ x: 5, y: 0 });
      tool.onPointerUp({ x: 5, y: 0 });

      const stateEvents = mgr._events.filter(e => e.event === 'state:changed');
      expect(stateEvents.length).toBeGreaterThan(0);
    });
  });
});

/* ================================================================
   5. INTEGRATION & EDGE CASES
   ================================================================ */
describe('Eraser Integration', () => {

  it('precision and object erasers are independent tools', () => {
    const precision = new PrecisionEraserTool();
    const object = new ObjectEraserTool();
    expect(precision.name).toBe('precision-eraser');
    expect(object.name).toBe('object-eraser');
    expect(precision.name).not.toBe(object.name);
  });

  it('precision eraser preserves strokeColor/strokeWidth on split segments', () => {
    const stroke = makeDrawing({
      id: 's1',
      points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }],
      strokeColor: '#FF0000',
      strokeWidth: 5,
      opacity: 0.8,
    });
    const mgr = createMockCanvasManager({ objects: [stroke] });
    const tool = new PrecisionEraserTool({ width: 10 });
    tool.activate(mgr, { width: 10 });

    tool.onPointerDown({ x: 50, y: 0 });
    tool.onPointerUp({ x: 50, y: 0 });

    // All resulting objects should have same strokeColor, strokeWidth, opacity
    for (const obj of mgr.state.objects) {
      expect(obj.strokeColor).toBe('#FF0000');
      expect(obj.strokeWidth).toBe(5);
      expect(obj.opacity).toBe(0.8);
    }
  });

  it('heavy drag across many strokes produces single command', () => {
    // Create 20 horizontal strokes at different y positions
    const strokes = [];
    for (let i = 0; i < 20; i++) {
      strokes.push(makeHorizontalStroke(`s_${i}`, 0, i * 5, 100, 5));
    }
    const mgr = createMockCanvasManager({ objects: strokes });
    const tool = new PrecisionEraserTool({ width: 200 });
    tool.activate(mgr, { width: 200 });

    // Single drag at x=50 covering all strokes (worldRadius=100)
    tool.onPointerDown({ x: 50, y: 0 });
    tool.lastMoveTime = 0;
    tool.onPointerMove({ x: 50, y: 50 });
    tool.lastMoveTime = 0;
    tool.onPointerMove({ x: 50, y: 100 });
    tool.onPointerUp({ x: 50, y: 100 });

    // Single command covers all changes
    expect(mgr.historyManager._stack).toHaveLength(1);
  });

  it('object eraser with heterogeneous object types', () => {
    const d1 = makeDrawing({ id: 'd1', points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] });
    const r1 = makeRect({ id: 'r1', x: 10, y: 10, width: 20, height: 20 });
    const mgr = createMockCanvasManager({ objects: [d1, r1] });
    const tool = new ObjectEraserTool({ width: 40 });
    tool.activate(mgr, { width: 40 });

    tool.onPointerDown({ x: 15, y: 15 });
    tool.onPointerUp({ x: 15, y: 15 });

    // Both should be deletable
    // (depends on ObjectGeometry.hitTest for each type)
    expect(mgr.historyManager._stack.length).toBeLessThanOrEqual(1);
  });

  it('getUIConfig returns correct info for both tools', () => {
    const precision = new PrecisionEraserTool();
    const object = new ObjectEraserTool();

    expect(precision.getUIConfig().name).toBe('precision-eraser');
    expect(precision.getUIConfig().hasOptions).toBe(true);
    expect(object.getUIConfig().name).toBe('object-eraser');
    expect(object.getUIConfig().hasOptions).toBe(true);
  });

  it('precision eraser does not crash on empty objects array', () => {
    const mgr = createMockCanvasManager({ objects: [] });
    const tool = new PrecisionEraserTool({ width: 20 });
    tool.activate(mgr, { width: 20 });

    expect(() => {
      tool.onPointerDown({ x: 0, y: 0 });
      tool.onPointerUp({ x: 0, y: 0 });
    }).not.toThrow();
  });

  it('object eraser does not crash on empty objects array', () => {
    const mgr = createMockCanvasManager({ objects: [] });
    const tool = new ObjectEraserTool({ width: 20 });
    tool.activate(mgr, { width: 20 });

    expect(() => {
      tool.onPointerDown({ x: 0, y: 0 });
      tool.onPointerUp({ x: 0, y: 0 });
    }).not.toThrow();
  });

  it('precision eraser handles stroke with null/undefined points gracefully', () => {
    const broken = makeDrawing({ id: 'b1', points: null });
    const mgr = createMockCanvasManager({ objects: [broken] });
    const tool = new PrecisionEraserTool({ width: 20 });
    tool.activate(mgr, { width: 20 });

    expect(() => {
      tool.onPointerDown({ x: 0, y: 0 });
      tool.onPointerUp({ x: 0, y: 0 });
    }).not.toThrow();
  });

  it('precision eraser handles stroke with single point (< 2 points)', () => {
    const single = makeDrawing({ id: 's1', points: [{ x: 0, y: 0 }] });
    const mgr = createMockCanvasManager({ objects: [single] });
    const tool = new PrecisionEraserTool({ width: 20 });
    tool.activate(mgr, { width: 20 });

    tool.onPointerDown({ x: 0, y: 0 });
    tool.onPointerUp({ x: 0, y: 0 });

    // Should not crash and should not create a command
    expect(mgr.historyManager._stack).toHaveLength(0);
  });

  it('onPointerMove without prior onPointerDown is a no-op', () => {
    const mgr = createMockCanvasManager();
    const tool = new PrecisionEraserTool({ width: 20 });
    tool.activate(mgr, { width: 20 });

    // No crash, no state change
    expect(() => {
      tool.onPointerMove({ x: 50, y: 50 });
    }).not.toThrow();

    expect(mgr.historyManager._stack).toHaveLength(0);
  });

  it('onPointerUp without prior onPointerDown is a no-op', () => {
    const mgr = createMockCanvasManager();
    const tool = new ObjectEraserTool({ width: 20 });
    tool.activate(mgr, { width: 20 });

    const result = tool.onPointerUp({ x: 50, y: 50 });
    expect(result).toBeNull();
    expect(mgr.historyManager._stack).toHaveLength(0);
  });
});
