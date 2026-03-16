/**
 * Additional edge-case tests targeting suspected bugs found via code review.
 *
 * Known issues identified:
 * 1. RotateCommand missing shape type support (ellipse, roundedRectangle, triangle, polygon, arrow, image)
 * 2. ClearCanvasCommand shallow-copies objects (shared references)
 * 3. ResizeCommand redo after state mutation
 * 4. MoveCommand handling for image objects
 * 5. Ellipse geometry handler validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createState, makeRect, makeCircle, makeLine, makeText, makeDrawing, makeTriangle, makeEllipse } from './helpers.js';

import { HistoryManager } from '../src/features/canvas/engine/history/HistoryManager.js';
import { AddShapeCommand } from '../src/features/canvas/engine/commands/ShapeCommands.js';
import { MoveCommand } from '../src/features/canvas/engine/commands/MoveCommand.js';
import { ResizeCommand } from '../src/features/canvas/engine/commands/ResizeCommand.js';
import { RotateCommand } from '../src/features/canvas/engine/commands/RotateCommand.js';
import { ClearCanvasCommand } from '../src/features/canvas/engine/commands/ViewportCommands.js';
import { TextCommand } from '../src/features/canvas/engine/commands/TextCommands.js';
import ObjectGeometry from '../src/features/canvas/engine/geometry/ObjectGeometry.js';

/* ================================================================
   BUG HUNT: RotateCommand missing shape types
   ================================================================ */
describe('BUG: RotateCommand — Missing Shape Types', () => {
  let state;

  beforeEach(() => {
    state = createState();
  });

  it('RotateCommand should handle ellipse geometry correctly', () => {
    const ellipse = makeEllipse({ id: 'e1', x: 100, y: 100, radiusX: 80, radiusY: 40 });
    state.objects.push(ellipse);
    const cmd = new RotateCommand(['e1'], Math.PI / 4, { x: 100, y: 100 });
    cmd.execute(state);
    // After rotation, the ellipse center should remain at same position (rotated around itself)
    // BUT if ellipse type is not handled, geometry is lost!
    expect(state.objects[0].x).toBeDefined();
    expect(state.objects[0].y).toBeDefined();
    expect(state.objects[0].radiusX).toBe(80);
    expect(state.objects[0].radiusY).toBe(40);
  });

  it('RotateCommand.undo should restore ellipse geometry', () => {
    const ellipse = makeEllipse({ id: 'e1', x: 200, y: 200, radiusX: 80, radiusY: 40 });
    state.objects.push(ellipse);
    const cmd = new RotateCommand(['e1'], Math.PI / 2, { x: 100, y: 100 });
    cmd.execute(state);
    // After 90° rotation around (100,100), center (200,200) → (100+100, 100+(-100)) = (200, 0)?
    // rotatePoint(200,200) around (100,100) by π/2: dx=100, dy=100 → (100 + 100*0 - 100*1, 100 + 100*1 + 100*0) = (0, 200)
    expect(state.objects[0].x).toBeCloseTo(0);
    expect(state.objects[0].y).toBeCloseTo(200);
    cmd.undo(state);
    // Undo should restore original values
    expect(state.objects[0].x).toBeCloseTo(200);
    expect(state.objects[0].y).toBeCloseTo(200);
    expect(state.objects[0].radiusX).toBe(80);
    expect(state.objects[0].radiusY).toBe(40);
  });

  it('RotateCommand should handle roundedRectangle correctly', () => {
    const rr = {
      id: 'rr1',
      type: 'roundedRectangle',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      cornerRadius: 10,
      rotation: 0,
      createdAt: Date.now(),
    };
    state.objects.push(rr);
    const cmd = new RotateCommand(['rr1'], Math.PI / 4, { x: 50, y: 50 });
    cmd.execute(state);
    // roundedRectangle should get a rotation property
    expect(state.objects[0].rotation).toBeCloseTo(Math.PI / 4);
    expect(state.objects[0].width).toBe(100);
    expect(state.objects[0].height).toBe(100);
  });

  it('RotateCommand.undo should restore roundedRectangle geometry', () => {
    const rr = {
      id: 'rr1',
      type: 'roundedRectangle',
      x: 50,
      y: 50,
      width: 100,
      height: 80,
      cornerRadius: 10,
      rotation: 0,
      createdAt: Date.now(),
    };
    state.objects.push(rr);
    const cmd = new RotateCommand(['rr1'], Math.PI / 3, { x: 100, y: 90 });
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].x).toBeCloseTo(50);
    expect(state.objects[0].y).toBeCloseTo(50);
    expect(state.objects[0].width).toBe(100);
    expect(state.objects[0].height).toBe(80);
    expect(state.objects[0].rotation).toBeCloseTo(0);
  });

  it('RotateCommand should handle triangle correctly', () => {
    const tri = makeTriangle({ id: 'tri1' });
    state.objects.push(tri);
    const originalPoints = tri.points.map(p => ({ ...p }));
    const cmd = new RotateCommand(['tri1'], Math.PI / 2, { x: 100, y: 100 });
    cmd.execute(state);
    // Points should have been rotated
    const currentPoints = state.objects[0].points;
    expect(currentPoints).toBeDefined();
    expect(currentPoints.length).toBe(3);
    // At least one coordinate should differ from original
    const changed = currentPoints.some((p, i) =>
      Math.abs(p.x - originalPoints[i].x) > 0.01 || Math.abs(p.y - originalPoints[i].y) > 0.01
    );
    expect(changed).toBe(true);
  });

  it('RotateCommand.undo should restore triangle points', () => {
    const tri = makeTriangle({ id: 'tri1' });
    state.objects.push(tri);
    const originalPoints = tri.points.map(p => ({ ...p }));
    const cmd = new RotateCommand(['tri1'], Math.PI / 2, { x: 100, y: 100 });
    cmd.execute(state);
    cmd.undo(state);
    state.objects[0].points.forEach((p, i) => {
      expect(p.x).toBeCloseTo(originalPoints[i].x);
      expect(p.y).toBeCloseTo(originalPoints[i].y);
    });
  });

  it('RotateCommand should handle arrow correctly', () => {
    const arrow = {
      id: 'arrow1',
      type: 'arrow',
      x1: 0, y1: 0, x2: 100, y2: 0,
      arrowSize: 10,
      strokeColor: '#000',
      createdAt: Date.now(),
    };
    state.objects.push(arrow);
    const cmd = new RotateCommand(['arrow1'], Math.PI / 2, { x: 50, y: 0 });
    cmd.execute(state);
    // Arrows use line endpoints, should be rotated like lines
    expect(state.objects[0].x1).toBeCloseTo(50);
    expect(state.objects[0].y1).toBeCloseTo(-50);
    expect(state.objects[0].x2).toBeCloseTo(50);
    expect(state.objects[0].y2).toBeCloseTo(50);
  });

  it('RotateCommand should handle image objects', () => {
    const img = {
      id: 'img1',
      type: 'image',
      x: 0, y: 0,
      width: 200, height: 150,
      rotation: 0,
      createdAt: Date.now(),
    };
    state.objects.push(img);
    const cmd = new RotateCommand(['img1'], Math.PI / 4, { x: 100, y: 75 });
    cmd.execute(state);
    // Image should get rotation like a rectangle
    expect(state.objects[0].rotation).toBeCloseTo(Math.PI / 4);
  });
});

/* ================================================================
   BUG HUNT: ClearCanvasCommand shared references
   ================================================================ */
describe('BUG: ClearCanvasCommand — Shallow Copy References', () => {
  let state, hm;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
  });

  it('undo after clear + mutating objects should restore clean state', () => {
    const rect = makeRect({ id: 'r1', x: 100, y: 100 });
    state.objects.push(rect);

    // Clear canvas
    const clearCmd = new ClearCanvasCommand();
    hm.execute(clearCmd, state);
    expect(state.objects).toHaveLength(0);

    // Undo clear
    hm.undo(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].x).toBe(100);

    // Now mutate the restored object
    state.objects[0].x = 999;

    // Re-do clear and re-undo should give us the MUTATED state
    // This is a shallow copy bug — previousObjects shares references
    hm.redo(state);
    hm.undo(state);
    // The object should have x=100 (original), but due to shallow copy it might be 999
    // This test exposes the bug
    expect(state.objects[0].x).toBe(100);
  });
});

/* ================================================================
   BUG HUNT: TextCommand previousState on multiple operations
   ================================================================ */
describe('BUG: TextCommand — previousState integrity', () => {
  let state, hm;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
  });

  it('multiple modify commands maintain correct previousState chain', () => {
    state.objects.push(makeText({ id: 'txt_1', text: 'version1' }));

    const mod1 = new TextCommand({ ...state.objects[0], text: 'version2' }, 'modify');
    hm.execute(mod1, state);
    expect(state.objects[0].text).toBe('version2');

    const mod2 = new TextCommand({ ...state.objects[0], text: 'version3' }, 'modify');
    hm.execute(mod2, state);
    expect(state.objects[0].text).toBe('version3');

    // Undo version3 → version2
    hm.undo(state);
    expect(state.objects[0].text).toBe('version2');

    // Undo version2 → version1
    hm.undo(state);
    expect(state.objects[0].text).toBe('version1');

    // Redo version1 → version2
    hm.redo(state);
    expect(state.objects[0].text).toBe('version2');

    // Redo version2 → version3
    hm.redo(state);
    expect(state.objects[0].text).toBe('version3');
  });
});

/* ================================================================
   BUG HUNT: MoveCommand — Image type
   ================================================================ */
describe('BUG: MoveCommand — Image Objects', () => {
  let state;

  beforeEach(() => {
    state = createState();
  });

  it('MoveCommand moves image object position', () => {
    const img = {
      id: 'img1',
      type: 'image',
      x: 50, y: 50,
      width: 200, height: 150,
      createdAt: Date.now(),
    };
    state.objects.push(img);
    const cmd = new MoveCommand(['img1'], { x: 30, y: 20 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(80);
    expect(state.objects[0].y).toBe(70);
  });

  it('MoveCommand undo restores image position', () => {
    const img = {
      id: 'img1',
      type: 'image',
      x: 50, y: 50,
      width: 200, height: 150,
      createdAt: Date.now(),
    };
    state.objects.push(img);
    const cmd = new MoveCommand(['img1'], { x: 30, y: 20 });
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].x).toBe(50);
    expect(state.objects[0].y).toBe(50);
  });
});

/* ================================================================
   BUG HUNT: Ellipse geometry handler
   ================================================================ */
describe('BUG: Ellipse Geometry Handler', () => {
  it('ellipse getBounds returns correct bounds', () => {
    const ellipse = { type: 'ellipse', x: 100, y: 100, radiusX: 50, radiusY: 30 };
    const bounds = ObjectGeometry.getBounds(ellipse);
    expect(bounds).not.toBeNull();
    // Bounds should be centered on (x,y) - (radiusX, radiusY)
    expect(bounds.x).toBeCloseTo(50);
    expect(bounds.y).toBeCloseTo(70);
    expect(bounds.width).toBeCloseTo(100);
    expect(bounds.height).toBeCloseTo(60);
  });

  it('ellipse hitTest detects point inside', () => {
    const ellipse = { type: 'ellipse', x: 100, y: 100, radiusX: 50, radiusY: 30 };
    expect(ObjectGeometry.hitTest({ x: 100, y: 100 }, ellipse)).toBe(true);
  });

  it('ellipse hitTest rejects distant point', () => {
    const ellipse = { type: 'ellipse', x: 100, y: 100, radiusX: 50, radiusY: 30 };
    expect(ObjectGeometry.hitTest({ x: 300, y: 300 }, ellipse)).toBe(false);
  });
});

/* ================================================================
   BUG HUNT: Arrow geometry handler
   ================================================================ */
describe('BUG: Arrow Geometry Handler', () => {
  it('arrow getBounds returns correct bounds', () => {
    const arrowObj = { type: 'arrow', x1: 10, y1: 20, x2: 110, y2: 120 };
    const bounds = ObjectGeometry.getBounds(arrowObj);
    expect(bounds).not.toBeNull();
    // Arrow getBounds intentionally adds arrowhead padding (arrowSize * 1.5)
    const arrowSize = arrowObj.arrowSize || 10;
    const padding = arrowSize * 1.5; // 15
    expect(bounds.x).toBe(Math.min(arrowObj.x1, arrowObj.x2) - padding);
    expect(bounds.y).toBe(Math.min(arrowObj.y1, arrowObj.y2) - padding);
    expect(bounds.width).toBe(Math.abs(arrowObj.x2 - arrowObj.x1) + padding * 2);
    expect(bounds.height).toBe(Math.abs(arrowObj.y2 - arrowObj.y1) + padding * 2);
  });

  it('arrow hitTest detects point near line', () => {
    const arrow = { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 0 };
    expect(ObjectGeometry.hitTest({ x: 50, y: 0 }, arrow, 5)).toBe(true);
  });
});

/* ================================================================
   BUG HUNT: ResizeCommand edge cases
   ================================================================ */
describe('BUG: ResizeCommand — Edge Cases', () => {
  let state;

  beforeEach(() => {
    state = createState();
  });

  it('resize with negative scale flips correctly', () => {
    state.objects.push(makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100 }));
    const cmd = new ResizeCommand(['r1'], {
      scaleX: -1,
      scaleY: 1,
      origin: { x: 50, y: 50 },
    });
    cmd.execute(state);
    expect(state.objects[0].flipX).toBe(true);
    expect(state.objects[0].width).toBeGreaterThanOrEqual(4);
  });

  it('resize with scale 0 clamps to MIN_SIZE', () => {
    state.objects.push(makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100 }));
    const cmd = new ResizeCommand(['r1'], {
      scaleX: 0,
      scaleY: 0,
      origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].width).toBeGreaterThanOrEqual(4);
    expect(state.objects[0].height).toBeGreaterThanOrEqual(4);
  });

  it('resize drawing scales all points', () => {
    state.objects.push(makeDrawing({ id: 'd1' }));
    const cmd = new ResizeCommand(['d1'], {
      scaleX: 2,
      scaleY: 2,
      origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].points[0].x).toBe(20);
    expect(state.objects[0].points[0].y).toBe(20);
  });
});

/* ================================================================
   BUG HUNT: History with mixed command types
   ================================================================ */
describe('BUG: History — Mixed command type undo/redo', () => {
  let state, hm;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
  });

  it('create → move → resize → undo all → redo all', () => {
    // Create
    const createCmd = new AddShapeCommand(makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100 }));
    hm.execute(createCmd, state);
    expect(state.objects).toHaveLength(1);

    // Move
    const moveCmd = new MoveCommand(['r1'], { x: 50, y: 50 });
    hm.execute(moveCmd, state);
    expect(state.objects[0].x).toBe(50);

    // Resize
    const resizeCmd = new ResizeCommand(['r1'], {
      scaleX: 2, scaleY: 2, origin: { x: 50, y: 50 },
    });
    hm.execute(resizeCmd, state);
    expect(state.objects[0].width).toBe(200);

    // Undo resize
    hm.undo(state);
    expect(state.objects[0].width).toBe(100);
    expect(state.objects[0].x).toBe(50);

    // Undo move
    hm.undo(state);
    expect(state.objects[0].x).toBe(0);

    // Undo create
    hm.undo(state);
    expect(state.objects).toHaveLength(0);

    // Redo create
    hm.redo(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].x).toBe(0);

    // Redo move
    hm.redo(state);
    expect(state.objects[0].x).toBe(50);

    // Redo resize
    hm.redo(state);
    expect(state.objects[0].width).toBe(200);
  });
});
