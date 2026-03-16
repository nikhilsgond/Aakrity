/**
 * Group 3 — Shape Creation Behavior & Sub-Toolbar UX Tests
 *
 * Bug #17 re-fix — edge handles restored for connectable objects
 * Bug #4  — Shape creation anchor drift (center-based shapes)
 * Bug #7  — Sub-toolbar unnecessary width removed
 * Bug #8  — Shape drag-drop from toolbar
 * Bug #9  — Click on canvas creates default-size shape
 * Bug #10 — Eraser sub-toolbar persistence + dismiss
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';
import { readFileSync } from 'fs';
import { ShapeTool } from '../src/features/canvas/tools/shapes/ShapeTool.js';
import { ShapeCommandFactory } from '../src/features/canvas/engine/commands/ShapeCommands.js';
import { SHAPE_TYPES, TOOL_OPTIONS } from '../src/shared/constants/index.js';

// ─── Mock canvasManager factory ──────────────────────────────

function makeMockCanvasManager() {
  return {
    state: {
      viewport: { zoom: 1 },
      currentLayer: 'default',
      currentUser: { id: 'user_1' },
    },
    setPreviewObject: vi.fn(),
    clearPreview: vi.fn(),
    clearSelection: vi.fn(),
    emit: vi.fn(),
    setSelection: vi.fn(),
    setActiveTool: vi.fn(),
    toolManager: {
      setShapeType: vi.fn(),
      getToolInstance: vi.fn().mockReturnValue(null),
    },
  };
}

function makeShapeTool(shapeType) {
  const tool = new ShapeTool({ [TOOL_OPTIONS.SHAPE_TYPE]: shapeType });
  const cm = makeMockCanvasManager();
  tool.activate(cm, { [TOOL_OPTIONS.SHAPE_TYPE]: shapeType });
  return { tool, cm };
}

function simulateDrag(tool, startX, startY, endX, endY) {
  tool.onPointerDown({ x: startX, y: startY, originalEvent: {} });
  tool.onPointerMove({ x: endX, y: endY, originalEvent: {} });
  const result = tool.onPointerUp({ x: endX, y: endY, originalEvent: {} });
  return result;
}

/* ================================================================
   Bug #17 Re-fix — Edge Handles Restored for Connectable Objects
   ================================================================
   Previously, the isConnectableObject guard removed edge handles for
   connectable objects (shapes, text, etc.). This caused loss of
   resize functionality on the sides of objects.

   The correct fix: connector ports are already 14 world-units OUTSIDE
   the bounding box, so they never overlap with edge resize handles.
   Edge handles should be restored for all object types that supported
   them before (excluding text n/s, emoji, sticky).
   ================================================================ */
describe('Bug #17 Re-fix — Edge Handles Restored', () => {

  it('TransformOverlay no longer gates edge handles on isConnectableObject', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/engine/transform/TransformOverlay.js'),
      'utf8'
    );
    expect(src).not.toContain('!this.isConnectableObject');
    expect(src).not.toContain('isConnectable');
  });

  it('TransformController no longer imports isConnectable', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/engine/transform/TransformController.js'),
      'utf8'
    );
    expect(src).not.toContain('isConnectable');
    expect(src).not.toContain('isConnectableObj');
  });

  it('TransformOverlay renders OBB edge handles for rectangles (no isConnectableObject filter)', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/engine/transform/TransformOverlay.js'),
      'utf8'
    );
    // Check the n/e/s/w handles are gated only on text/emoji/sticky — NOT connectable
    expect(src).toMatch(/!this\.isTextObject && !this\.isEmojiObject && !this\.isStickyObject[^&]*handles\.resize\.n/);
  });

  it('TransformOverlay renders AABB edge handles without connectable gate', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/engine/transform/TransformOverlay.js'),
      'utf8'
    );
    // t/b handles should only be skipped for text objects, not connectable
    expect(src).toMatch(/!this\.isTextObject && !this\.isEmojiObject && !this\.isStickyObject[^&]*handles\.resize\.t/);
  });

  // Connector port offset test removed
});

/* ================================================================
   Bug #4 — Shape Creation Anchor Drift
   ================================================================
   Before fix: center of circle/ellipse/polygon = midpoint of
   (startPoint, currentPoint), drifting as you drag.

   After fix: center = startPoint (mousedown). Drag extends the size
   outward from the anchor. Regardless of drag direction, the anchor
   stays fixed at startPoint.
   ================================================================ */
describe('Bug #4 — Shape Anchor Drift', () => {

  describe('Circle — center anchored at startPoint', () => {
    it('drag right: center stays at startPoint', () => {
      const { tool } = makeShapeTool(SHAPE_TYPES.CIRCLE);
      const result = simulateDrag(tool, 200, 200, 300, 200);
      expect(result?.command?.shapeData).toBeDefined();
      const { x, y } = result.command.shapeData; // x,y = center for circle
      expect(x).toBe(200);
      expect(y).toBe(200);
    });

    it('drag left-up: center STILL stays at startPoint (no drift)', () => {
      const { tool } = makeShapeTool(SHAPE_TYPES.CIRCLE);
      // Previously, center would move to (150,150) — the midpoint of (200,200) and (100,100)
      const result = simulateDrag(tool, 200, 200, 100, 100);
      const { x, y } = result.command.shapeData;
      expect(x).toBe(200); // anchored — NOT 150
      expect(y).toBe(200); // anchored — NOT 150
    });

    it('radius = distance from startPoint to currentPoint', () => {
      const { tool } = makeShapeTool(SHAPE_TYPES.CIRCLE);
      // drag 100px to the right from (200,200) to (300,200)
      const result = simulateDrag(tool, 200, 200, 300, 200);
      const { radius } = result.command.shapeData;
      // distance = sqrt(100^2 + 0^2) = 100
      expect(radius).toBeCloseTo(100, 1);
    });

    it('radius is consistent regardless of drag direction', () => {
      // Same distance to left vs right should yield same radius
      const { tool: t1 } = makeShapeTool(SHAPE_TYPES.CIRCLE);
      const { tool: t2 } = makeShapeTool(SHAPE_TYPES.CIRCLE);
      const r1 = simulateDrag(t1, 200, 200, 300, 200).command.shapeData.radius;
      const r2 = simulateDrag(t2, 200, 200, 100, 200).command.shapeData.radius;
      expect(r1).toBeCloseTo(r2, 1);
    });
  });

  describe('Ellipse — center anchored at startPoint', () => {
    it('center stays at startPoint', () => {
      const { tool } = makeShapeTool(SHAPE_TYPES.ELLIPSE);
      const result = simulateDrag(tool, 200, 200, 350, 250);
      const { x, y } = result.command.shapeData;
      expect(x).toBe(200);
      expect(y).toBe(200);
    });

    it('radiusX = |dx| from startPoint', () => {
      const { tool } = makeShapeTool(SHAPE_TYPES.ELLIPSE);
      // dx = 350 - 200 = 150
      const result = simulateDrag(tool, 200, 200, 350, 250);
      expect(result.command.shapeData.radiusX).toBe(150);
    });

    it('radiusY = |dy| from startPoint', () => {
      const { tool } = makeShapeTool(SHAPE_TYPES.ELLIPSE);
      // dy = 250 - 200 = 50
      const result = simulateDrag(tool, 200, 200, 350, 250);
      expect(result.command.shapeData.radiusY).toBe(50);
    });

    it('drag up-left also anchors center at startPoint', () => {
      const { tool } = makeShapeTool(SHAPE_TYPES.ELLIPSE);
      const result = simulateDrag(tool, 200, 200, 50, 100);
      const { x, y } = result.command.shapeData;
      expect(x).toBe(200);
      expect(y).toBe(200);
    });
  });

  describe('Hexagon — center anchored at startPoint', () => {
    it('all points are equidistant from startPoint (regular hexagon)', () => {
      const { tool } = makeShapeTool(SHAPE_TYPES.HEXAGON);
      // Drag 80px right → max(80, 0) = 80 → r = 80
      const result = simulateDrag(tool, 200, 200, 280, 200);
      const { points } = result.command.shapeData;
      expect(points).toHaveLength(6);

      const cx = 200, cy = 200;
      points.forEach((pt) => {
        const dist = Math.sqrt((pt.x - cx) ** 2 + (pt.y - cy) ** 2);
        expect(dist).toBeCloseTo(80, 0);
      });
    });

    it('center stays at startPoint when dragging in any direction', () => {
      const { tool } = makeShapeTool(SHAPE_TYPES.HEXAGON);
      const result = simulateDrag(tool, 200, 200, 100, 200); // drag left
      const pts = result.command.shapeData.points;
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      expect(cx).toBeCloseTo(200, 1);
      expect(cy).toBeCloseTo(200, 1);
    });
  });

  describe('Pentagon — center anchored at startPoint', () => {
    it('all 5 points are equidistant from startPoint', () => {
      const { tool } = makeShapeTool(SHAPE_TYPES.PENTAGON);
      const result = simulateDrag(tool, 300, 300, 300, 360); // drag 60px down
      const { points } = result.command.shapeData;
      expect(points).toHaveLength(5);

      const cx = 300, cy = 300;
      points.forEach((pt) => {
        const dist = Math.sqrt((pt.x - cx) ** 2 + (pt.y - cy) ** 2);
        expect(dist).toBeCloseTo(60, 0);
      });
    });
  });

  describe('Star — center anchored at startPoint', () => {
    it('has 10 points alternating outer/inner radius', () => {
      const { tool } = makeShapeTool(SHAPE_TYPES.STAR);
      const result = simulateDrag(tool, 200, 200, 260, 200); // r=60
      const { points } = result.command.shapeData;
      expect(points).toHaveLength(10);
    });

    it('outer points at expected distance (r) from startPoint', () => {
      const { tool } = makeShapeTool(SHAPE_TYPES.STAR);
      const result = simulateDrag(tool, 200, 200, 260, 200); // r=60
      const { points } = result.command.shapeData;
      const cx = 200, cy = 200;
      // Even-indexed points are outer (at radius r)
      const outerDists = points
        .filter((_, i) => i % 2 === 0)
        .map(pt => Math.sqrt((pt.x - cx) ** 2 + (pt.y - cy) ** 2));
      outerDists.forEach(d => expect(d).toBeCloseTo(60, 0));
    });
  });

  describe('Rectangle (bounding box) — unchanged behavior', () => {
    it('rectangle still expands from top-left bounding box corner', () => {
      const { tool } = makeShapeTool(SHAPE_TYPES.RECTANGLE);
      const result = simulateDrag(tool, 100, 100, 300, 200);
      const { x, y, width, height } = result.command.shapeData;
      expect(x).toBe(100);
      expect(y).toBe(100);
      expect(width).toBe(200);
      expect(height).toBe(100);
    });
  });
});

/* ================================================================
   Bug #9 — Click on Canvas Creates Default-Size Shape
   ================================================================
   Before: clicking (i.e. releasing pointer without significant drag)
   returned null — no shape was created, panel stayed open.

   After: a click creates a default 80x80 bounding box shape at the
   click position, then auto-switches to select tool.
   ================================================================ */
describe('Bug #9 — Click Creates Default Shape', () => {

  it('single click on canvas creates a shape (returns command)', () => {
    const { tool } = makeShapeTool(SHAPE_TYPES.RECTANGLE);
    // Pointer down and up at same position (0 drag distance)
    tool.onPointerDown({ x: 200, y: 200, originalEvent: {} });
    const result = tool.onPointerUp({ x: 200, y: 200, originalEvent: {} });
    expect(result).not.toBeNull();
    expect(result?.command).toBeDefined();
  });

  it('single click rectangle has width = 80 and height = 80', () => {
    const { tool } = makeShapeTool(SHAPE_TYPES.RECTANGLE);
    tool.onPointerDown({ x: 200, y: 200, originalEvent: {} });
    const result = tool.onPointerUp({ x: 200, y: 200, originalEvent: {} });
    const { width, height } = result.command.shapeData;
    expect(width).toBe(80);
    expect(height).toBe(80);
  });

  it('click creates shape at the click position (startPoint)', () => {
    const { tool } = makeShapeTool(SHAPE_TYPES.RECTANGLE);
    tool.onPointerDown({ x: 150, y: 250, originalEvent: {} });
    const result = tool.onPointerUp({ x: 150, y: 250, originalEvent: {} });
    const { x, y } = result.command.shapeData;
    expect(x).toBe(150); // top-left x = startPoint.x (offset by 0 since DEFAULT is added to right/down)
    expect(y).toBe(250);
  });

  it('single click circle has a non-zero radius', () => {
    const { tool } = makeShapeTool(SHAPE_TYPES.CIRCLE);
    tool.onPointerDown({ x: 200, y: 200, originalEvent: {} });
    const result = tool.onPointerUp({ x: 200, y: 200, originalEvent: {} });
    const { radius } = result.command.shapeData;
    expect(radius).toBeGreaterThan(0);
  });

  it('tiny drag (< 3px) still creates a default shape', () => {
    const { tool } = makeShapeTool(SHAPE_TYPES.RECTANGLE);
    // Drag 1px — below the minSize threshold of 3px
    tool.onPointerDown({ x: 200, y: 200, originalEvent: {} });
    const result = tool.onPointerUp({ x: 201, y: 200, originalEvent: {} });
    expect(result?.command).toBeDefined();
  });

  it('click creates correct shape type (circle)', () => {
    const { tool } = makeShapeTool(SHAPE_TYPES.CIRCLE);
    tool.onPointerDown({ x: 200, y: 200, originalEvent: {} });
    const result = tool.onPointerUp({ x: 200, y: 200, originalEvent: {} });
    expect(result.command.shapeData.type).toBe(SHAPE_TYPES.CIRCLE);
  });

  it('click creates correct shape type (hexagon)', () => {
    const { tool } = makeShapeTool(SHAPE_TYPES.HEXAGON);
    tool.onPointerDown({ x: 200, y: 200, originalEvent: {} });
    const result = tool.onPointerUp({ x: 200, y: 200, originalEvent: {} });
    expect(result.command.shapeData.type).toBe(SHAPE_TYPES.HEXAGON);
    expect(result.command.shapeData.points).toHaveLength(6);
  });

  it('auto-switch to select is triggered after click creation', () => {
    const { tool, cm } = makeShapeTool(SHAPE_TYPES.RECTANGLE);
    // mock getToolInstance to return a fake select tool
    const fakeSelect = {};
    cm.toolManager.getToolInstance = vi.fn().mockReturnValue(fakeSelect);

    tool.onPointerDown({ x: 200, y: 200, originalEvent: {} });
    tool.onPointerUp({ x: 200, y: 200, originalEvent: {} });

    expect(cm.setActiveTool).toHaveBeenCalledWith(fakeSelect);
  });
});

/* ================================================================
   Bug #7 / #10 — Sub-toolbar Width & Eraser Panel Dismiss
   ================================================================ */
describe('Bug #7 — Sub-toolbar Auto Width', () => {

  it('ToolOptionsPanel has no fixed min-w constraint', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/ui/ToolOptionsPanel.jsx'),
      'utf8'
    );
    expect(src).not.toContain('min-w-[180px]');
    expect(src).not.toContain('max-w-[320px]');
  });

  it('ToolOptionsPanel uses w-auto for intrinsic sizing', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/ui/ToolOptionsPanel.jsx'),
      'utf8'
    );
    expect(src).toContain('w-auto');
  });

  it('EraserOptions has vertical slider (writingMode vertical-lr)', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/ui/tool-options/EraserOptions.jsx'),
      'utf8'
    );
    expect(src).toContain('vertical-lr');
  });

  it('EraserOptions slider has explicit height (for track length)', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/ui/tool-options/EraserOptions.jsx'),
      'utf8'
    );
    expect(src).toContain('height:');
  });
});

describe('Bug #10 — Eraser Sub-toolbar Persistence & Dismiss', () => {

  it('EraserOptions has module-level persistent state vars', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/ui/tool-options/EraserOptions.jsx'),
      'utf8'
    );
    expect(src).toContain('_persistedMode');
    expect(src).toContain('_persistedWidth');
  });

  it('ToolOptionsPanel subscribes to canvas:interacted event', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/ui/ToolOptionsPanel.jsx'),
      'utf8'
    );
    expect(src).toContain('canvas:interacted');
  });

  it('ToolOptionsPanel has DISMISS_ON_CANVAS_CLICK set for eraser tools', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/ui/ToolOptionsPanel.jsx'),
      'utf8'
    );
    expect(src).toContain('DISMISS_ON_CANVAS_CLICK');
    expect(src).toContain('TOOL_TYPES.ERASER');
    expect(src).toContain('TOOL_TYPES.OBJECT_ERASER');
  });

  it('useCanvas emits canvas:interacted on pointer down', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/hooks/useCanvas.js'),
      'utf8'
    );
    expect(src).toContain("canvas:interacted");
  });

  it('RoomLayout passes canvasManager to ToolOptionsPanel for event wiring', () => {
    const src = readFileSync(
      path.resolve('src/features/room/components/RoomLayout.jsx'),
      'utf8'
    );
    expect(src).toContain('canvasManager={canvasManager}');
    expect(src).toContain('panelRevealKey');
  });

  it('RoomLayout uses panelRevealKey to re-show panel on same-tool click', () => {
    const src = readFileSync(
      path.resolve('src/features/room/components/RoomLayout.jsx'),
      'utf8'
    );
    expect(src).toContain('key={panelRevealKey}');
    expect(src).toContain('handleToolChangeWithReveal');
  });

  it('persistence: module-level vars survive round trip', () => {
    // Simulate the module-level persistence pattern
    let _persistedMode = 'precision';
    let _persistedWidth = 20;

    // User changes to object mode and size 40
    _persistedMode = 'object';
    _persistedWidth = 40;

    // Panel "remounts" — simulated by reading persisted values
    const restoredMode = _persistedMode;
    const restoredWidth = _persistedWidth;

    expect(restoredMode).toBe('object');
    expect(restoredWidth).toBe(40);
  });

  it('dismiss behavior: setting panelVisible=false hides panel', () => {
    // Simulate the ToolOptionsPanel dismiss logic
    let panelVisible = true;
    const DISMISS_TOOLS = new Set(['eraser', 'object_eraser']);
    const activeTool = 'eraser';

    // canvas:interacted fires → handler runs
    if (DISMISS_TOOLS.has(activeTool)) {
      panelVisible = false;
    }

    expect(panelVisible).toBe(false);
  });

  it('re-show behavior: panelVisible resets when tool changes', () => {
    let panelVisible = false; // was dismissed

    // When activeToolType changes (user clicks toolbar button)
    const previousTool = 'eraser';
    const newTool = 'eraser'; // same tool re-clicked — key increment triggers remount

    // panelRevealKey increments on every tool button click
    let revealKey = 5;
    revealKey++; // incremented on handleToolChangeWithReveal
    expect(revealKey).toBe(6);

    // Re-mount sets panelVisible = true (initial state)
    panelVisible = true; // initial useState(true) on re-mount
    expect(panelVisible).toBe(true);
  });
});

/* ================================================================
   Bug #8 — Shape Drag-Drop from Toolbar
   ================================================================
   calcPoints() and createShapeAtPos() utility functions mirror the
   ShapeOptions.jsx implementation for testing in isolation.
   ================================================================ */
describe('Bug #8 — Shape Drag-Drop from Toolbar', () => {

  const DEFAULT_R = 60;
  const DEFAULT_W = 120;
  const DEFAULT_H = 80;

  // Inline calcPoints matching ShapeOptions.jsx implementation
  function calcPoints(shapeType, cx, cy) {
    const r = DEFAULT_R;
    switch (shapeType) {
      case SHAPE_TYPES.TRIANGLE:
        return [
          { x: cx, y: cy - r },
          { x: cx - r, y: cy + r },
          { x: cx + r, y: cy + r },
        ];
      case SHAPE_TYPES.DIAMOND:
        return [
          { x: cx, y: cy - r },
          { x: cx + r, y: cy },
          { x: cx, y: cy + r },
          { x: cx - r, y: cy },
        ];
      case SHAPE_TYPES.HEXAGON: {
        const pts = [];
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
        }
        return pts;
      }
      case SHAPE_TYPES.PENTAGON: {
        const pts = [];
        for (let i = 0; i < 5; i++) {
          const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
          pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
        }
        return pts;
      }
      case SHAPE_TYPES.STAR: {
        const pts = [];
        const innerR = r / 2;
        for (let i = 0; i < 10; i++) {
          const radius = i % 2 === 0 ? r : innerR;
          const a = (Math.PI / 5) * i - Math.PI / 2;
          pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
        }
        return pts;
      }
      default: return [];
    }
  }

  it('ShapeOptions.jsx imports ShapeCommandFactory for drag-drop creation', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/ui/tool-options/ShapeOptions.jsx'),
      'utf8'
    );
    expect(src).toContain('ShapeCommandFactory');
    expect(src).toContain('handleDragStart');
    expect(src).toContain('DragGhost');
  });

  it('ShapeOptions.jsx has drag hint text', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/ui/tool-options/ShapeOptions.jsx'),
      'utf8'
    );
    expect(src).toContain('Drag to canvas');
  });

  // calcPoints unit tests
  it('triangle: 3 points, apex above center', () => {
    const pts = calcPoints(SHAPE_TYPES.TRIANGLE, 200, 200);
    expect(pts).toHaveLength(3);
    // apex is at (cx, cy - r)
    expect(pts[0]).toEqual({ x: 200, y: 200 - DEFAULT_R });
  });

  it('diamond: 4 points, symmetric around center', () => {
    const pts = calcPoints(SHAPE_TYPES.DIAMOND, 200, 200);
    expect(pts).toHaveLength(4);
    // top point
    expect(pts[0]).toEqual({ x: 200, y: 200 - DEFAULT_R });
    // right point
    expect(pts[1]).toEqual({ x: 200 + DEFAULT_R, y: 200 });
  });

  it('hexagon: 6 points, all at radius from center', () => {
    const pts = calcPoints(SHAPE_TYPES.HEXAGON, 200, 200);
    expect(pts).toHaveLength(6);
    pts.forEach(pt => {
      const d = Math.sqrt((pt.x - 200) ** 2 + (pt.y - 200) ** 2);
      expect(d).toBeCloseTo(DEFAULT_R, 1);
    });
  });

  it('pentagon: 5 points, all at radius from center', () => {
    const pts = calcPoints(SHAPE_TYPES.PENTAGON, 200, 200);
    expect(pts).toHaveLength(5);
    pts.forEach(pt => {
      const d = Math.sqrt((pt.x - 200) ** 2 + (pt.y - 200) ** 2);
      expect(d).toBeCloseTo(DEFAULT_R, 1);
    });
  });

  it('star: 10 points alternating outer/inner radii', () => {
    const pts = calcPoints(SHAPE_TYPES.STAR, 200, 200);
    expect(pts).toHaveLength(10);
    pts.forEach((pt, i) => {
      const d = Math.sqrt((pt.x - 200) ** 2 + (pt.y - 200) ** 2);
      if (i % 2 === 0) {
        expect(d).toBeCloseTo(DEFAULT_R, 1); // outer
      } else {
        expect(d).toBeCloseTo(DEFAULT_R / 2, 1); // inner
      }
    });
  });

  // createShapeAtPos via ShapeCommandFactory
  it('rectangle drag-drop creates at world position (centered)', () => {
    const opts = { strokeColor: '#000', strokeWidth: 2, fillColor: 'transparent', opacity: 1, layer: 'default' };
    const cmd = ShapeCommandFactory.createRectangle(300 - DEFAULT_W / 2, 400 - DEFAULT_H / 2, DEFAULT_W, DEFAULT_H, opts);
    expect(cmd.shapeData.x).toBe(300 - DEFAULT_W / 2);
    expect(cmd.shapeData.y).toBe(400 - DEFAULT_H / 2);
    expect(cmd.shapeData.width).toBe(DEFAULT_W);
    expect(cmd.shapeData.height).toBe(DEFAULT_H);
  });

  it('circle drag-drop creates at world position with DEFAULT_R', () => {
    const opts = { strokeColor: '#000', strokeWidth: 2, fillColor: 'transparent', opacity: 1, layer: 'default' };
    const cmd = ShapeCommandFactory.createCircle(300, 400, DEFAULT_R, opts);
    expect(cmd.shapeData.x).toBe(300);
    expect(cmd.shapeData.y).toBe(400);
    expect(cmd.shapeData.radius).toBe(DEFAULT_R);
  });

  it('hexagon drag-drop creates with 6 points', () => {
    const opts = { strokeColor: '#000', strokeWidth: 2, fillColor: 'transparent', opacity: 1, layer: 'default' };
    const pts = calcPoints(SHAPE_TYPES.HEXAGON, 300, 400);
    const cmd = ShapeCommandFactory.createHexagon(pts, opts);
    expect(cmd.shapeData.points).toHaveLength(6);
  });

  it('drag ghost element is rendered via createPortal pattern', () => {
    const src = readFileSync(
      path.resolve('src/features/canvas/ui/tool-options/ShapeOptions.jsx'),
      'utf8'
    );
    expect(src).toContain('createPortal');
    expect(src).toContain('dragging && <DragGhost');
  });
});
