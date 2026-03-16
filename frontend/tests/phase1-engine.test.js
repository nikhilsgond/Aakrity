/**
 * Phase 1 — Core Engine Tests
 *
 * A. Object Lifecycle (Create / Delete / Update)
 * B. Selection (single, multi, clear, top-most, after zoom)
 * C. Move (updates x,y; respects zoom; blocked if locked)
 * D. Resize (width/height updated; min size; resize after rotation; text auto-height)
 * E. Rotate (angle updates; bounding box recalculated; rotation persists after move)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createState, makeRect, makeCircle, makeLine, makeText, makeDrawing, makeTriangle, makeEllipse } from './helpers.js';

// Commands
import { AddShapeCommand, ShapeCommandFactory } from '../src/features/canvas/engine/commands/ShapeCommands.js';
import { MoveCommand } from '../src/features/canvas/engine/commands/MoveCommand.js';
import { ResizeCommand } from '../src/features/canvas/engine/commands/ResizeCommand.js';
import { RotateCommand } from '../src/features/canvas/engine/commands/RotateCommand.js';
import { SelectObjectsCommand, ClearSelectionCommand, DeselectObjectsCommand } from '../src/features/canvas/engine/commands/SelectionCommands.js';
import { TextCommand } from '../src/features/canvas/engine/commands/TextCommands.js';
import { PencilCommand } from '../src/features/canvas/engine/commands/PencilCommands.js';

// History
import { HistoryManager } from '../src/features/canvas/engine/history/HistoryManager.js';

// Selection
import SelectionManager from '../src/features/canvas/engine/SelectionManager.js';

/* ================================================================
   A. Object Lifecycle
   ================================================================ */
describe('Phase 1A — Object Lifecycle', () => {
  let state;

  beforeEach(() => {
    state = createState();
  });

  // ---- CREATE ----
  it('AddShapeCommand adds a rectangle to state.objects', () => {
    const rect = makeRect();
    const cmd = new AddShapeCommand(rect);
    cmd.execute(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].id).toBe('rect_1');
    expect(state.objects[0].type).toBe('rectangle');
  });

  it('AddShapeCommand is idempotent — executing twice does not duplicate', () => {
    const rect = makeRect();
    const cmd = new AddShapeCommand(rect);
    cmd.execute(state);
    cmd.execute(state);
    expect(state.objects).toHaveLength(1);
  });

  it('PencilCommand adds a drawing to state.objects', () => {
    const cmd = new PencilCommand(
      [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      { strokeColor: '#000', strokeWidth: 2, opacity: 1, id: 'draw_1' }
    );
    cmd.execute(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].type).toBe('drawing');
    expect(state.objects[0].id).toBe('draw_1');
  });

  it('TextCommand (add) adds a text object', () => {
    const textObj = makeText();
    const cmd = new TextCommand(textObj, 'add');
    cmd.execute(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].type).toBe('text');
  });

  // ---- DELETE ----
  it('AddShapeCommand.undo removes the shape', () => {
    const rect = makeRect();
    const cmd = new AddShapeCommand(rect);
    cmd.execute(state);
    expect(state.objects).toHaveLength(1);
    cmd.undo(state);
    expect(state.objects).toHaveLength(0);
  });

  it('TextCommand (delete) removes the text object', () => {
    const textObj = makeText();
    state.objects.push({ ...textObj });
    const cmd = new TextCommand(textObj, 'delete');
    cmd.execute(state);
    expect(state.objects).toHaveLength(0);
  });

  it('TextCommand (delete) undo restores the text object', () => {
    const textObj = makeText();
    state.objects.push({ ...textObj });
    const cmd = new TextCommand(textObj, 'delete');
    cmd.execute(state);
    expect(state.objects).toHaveLength(0);
    cmd.undo(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].id).toBe('text_1');
  });

  // ---- UPDATE ----
  it('TextCommand (modify) updates text properties', () => {
    const textObj = makeText();
    state.objects.push({ ...textObj });
    const updatedText = { ...textObj, text: 'Updated text', fontSize: 24 };
    const cmd = new TextCommand(updatedText, 'modify');
    cmd.execute(state);
    expect(state.objects[0].text).toBe('Updated text');
    expect(state.objects[0].fontSize).toBe(24);
  });

  it('TextCommand (modify) undo restores original text', () => {
    const textObj = makeText();
    state.objects.push({ ...textObj });
    const updatedText = { ...textObj, text: 'Changed', fontSize: 32 };
    const cmd = new TextCommand(updatedText, 'modify');
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].text).toBe('Hello World');
    expect(state.objects[0].fontSize).toBe(16);
  });

  // ---- Multiple object types ----
  it('can add multiple different object types', () => {
    const cmd1 = new AddShapeCommand(makeRect({ id: 'r1' }));
    const cmd2 = new AddShapeCommand(makeCircle({ id: 'c1' }));
    const cmd3 = new PencilCommand(
      [{ x: 0, y: 0 }, { x: 5, y: 5 }],
      { id: 'draw_test' }
    );
    cmd1.execute(state);
    cmd2.execute(state);
    cmd3.execute(state);
    expect(state.objects).toHaveLength(3);
    expect(state.objects.map(o => o.type)).toEqual(['rectangle', 'circle', 'drawing']);
  });
});

/* ================================================================
   B. Selection
   ================================================================ */
describe('Phase 1B — Selection', () => {
  let state;

  beforeEach(() => {
    state = createState();
    // Pre-populate with some objects
    state.objects.push(makeRect({ id: 'r1' }));
    state.objects.push(makeCircle({ id: 'c1' }));
    state.objects.push(makeRect({ id: 'r2', x: 120, y: 120 }));
  });

  it('SelectObjectsCommand selects a single object', () => {
    const cmd = new SelectObjectsCommand(['r1']);
    cmd.execute(state);
    expect(state.selection).toEqual(['r1']);
  });

  it('SelectObjectsCommand replaces previous selection by default', () => {
    state.selection = ['r1'];
    const cmd = new SelectObjectsCommand(['c1']);
    cmd.execute(state);
    expect(state.selection).toEqual(['c1']);
  });

  it('SelectObjectsCommand additive mode adds to selection', () => {
    state.selection = ['r1'];
    const cmd = new SelectObjectsCommand(['c1'], false);
    cmd.execute(state);
    expect(state.selection).toContain('r1');
    expect(state.selection).toContain('c1');
  });

  it('SelectObjectsCommand multi-select works', () => {
    const cmd = new SelectObjectsCommand(['r1', 'c1', 'r2']);
    cmd.execute(state);
    expect(state.selection).toHaveLength(3);
  });

  it('ClearSelectionCommand clears selection', () => {
    state.selection = ['r1', 'c1'];
    const cmd = new ClearSelectionCommand();
    cmd.execute(state);
    expect(state.selection).toHaveLength(0);
  });

  it('ClearSelectionCommand undo restores previous selection', () => {
    state.selection = ['r1', 'c1'];
    const cmd = new ClearSelectionCommand();
    cmd.execute(state);
    cmd.undo(state);
    expect(state.selection).toEqual(['r1', 'c1']);
  });

  it('DeselectObjectsCommand removes specific objects from selection', () => {
    state.selection = ['r1', 'c1', 'r2'];
    const cmd = new DeselectObjectsCommand(['c1']);
    cmd.execute(state);
    expect(state.selection).toEqual(['r1', 'r2']);
  });

  it('DeselectObjectsCommand undo restores removed objects', () => {
    state.selection = ['r1', 'c1', 'r2'];
    const cmd = new DeselectObjectsCommand(['c1', 'r2']);
    cmd.execute(state);
    cmd.undo(state);
    expect(state.selection).toEqual(['r1', 'c1', 'r2']);
  });

  // ---- SelectionManager tests ----
  it('SelectionManager.select selects a single id', () => {
    const sm = new SelectionManager();
    sm.select('r1');
    expect(sm.getSelectedIds()).toEqual(['r1']);
  });

  it('SelectionManager.select non-additive clears previous', () => {
    const sm = new SelectionManager();
    sm.select('r1');
    sm.select('c1');
    expect(sm.getSelectedIds()).toEqual(['c1']);
  });

  it('SelectionManager.select additive keeps previous', () => {
    const sm = new SelectionManager();
    sm.select('r1');
    sm.select('c1', true);
    expect(sm.getSelectedIds()).toContain('r1');
    expect(sm.getSelectedIds()).toContain('c1');
  });

  it('SelectionManager.clear empties selection', () => {
    const sm = new SelectionManager();
    sm.select('r1');
    sm.select('c1', true);
    sm.clear();
    expect(sm.hasSelection()).toBe(false);
  });

  it('SelectionManager.toggle adds/removes ids', () => {
    const sm = new SelectionManager();
    sm.select('r1');
    sm.toggle('r1');
    expect(sm.getSelectedIds()).toEqual([]);
    sm.toggle('r1');
    expect(sm.getSelectedIds()).toEqual(['r1']);
  });

  it('SelectionManager.set replaces entire selection', () => {
    const sm = new SelectionManager();
    sm.set(['r1', 'c1', 'r2']);
    expect(sm.getSelectedIds()).toHaveLength(3);
    sm.set(['r2']);
    expect(sm.getSelectedIds()).toEqual(['r2']);
  });

  it('SelectionManager marquee lifecycle', () => {
    const sm = new SelectionManager();
    sm.startMarquee({ x: 10, y: 10 });
    expect(sm.isMarqueeActive()).toBe(true);
    expect(sm.getMode()).toBe('marquee');
    sm.updateMarquee({ x: 50, y: 50 });
    const rect = sm.getMarqueeRect();
    expect(rect).toEqual({ x: 10, y: 10, width: 40, height: 40 });
    sm.endMarquee();
    expect(sm.isMarqueeActive()).toBe(false);
    expect(sm.getMode()).toBe('idle');
  });
});

/* ================================================================
   C. Move
   ================================================================ */
describe('Phase 1C — Move', () => {
  let state;

  beforeEach(() => {
    state = createState();
  });

  it('MoveCommand updates x,y for rectangle', () => {
    const rect = makeRect({ id: 'r1', x: 100, y: 100 });
    state.objects.push(rect);
    const cmd = new MoveCommand(['r1'], { x: 50, y: 30 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(150);
    expect(state.objects[0].y).toBe(130);
  });

  it('MoveCommand updates circle position', () => {
    const circle = makeCircle({ id: 'c1', x: 200, y: 200 });
    state.objects.push(circle);
    const cmd = new MoveCommand(['c1'], { x: -50, y: 25 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(150);
    expect(state.objects[0].y).toBe(225);
  });

  it('MoveCommand updates line endpoints', () => {
    const line = makeLine({ id: 'l1', x1: 0, y1: 0, x2: 100, y2: 100 });
    state.objects.push(line);
    const cmd = new MoveCommand(['l1'], { x: 10, y: 20 });
    cmd.execute(state);
    expect(state.objects[0].x1).toBe(10);
    expect(state.objects[0].y1).toBe(20);
    expect(state.objects[0].x2).toBe(110);
    expect(state.objects[0].y2).toBe(120);
  });

  it('MoveCommand updates all points of a drawing', () => {
    const drawing = makeDrawing({ id: 'd1' });
    state.objects.push(drawing);
    const cmd = new MoveCommand(['d1'], { x: 5, y: 5 });
    cmd.execute(state);
    expect(state.objects[0].points[0].x).toBe(15);
    expect(state.objects[0].points[0].y).toBe(15);
  });

  it('MoveCommand undo restores original position', () => {
    const rect = makeRect({ id: 'r1', x: 100, y: 100 });
    state.objects.push(rect);
    const cmd = new MoveCommand(['r1'], { x: 50, y: 50 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(150);
    cmd.undo(state);
    expect(state.objects[0].x).toBe(100);
    expect(state.objects[0].y).toBe(100);
  });

  it('MoveCommand moves multiple objects at once', () => {
    state.objects.push(makeRect({ id: 'r1', x: 100, y: 100 }));
    state.objects.push(makeCircle({ id: 'c1', x: 200, y: 200 }));
    const cmd = new MoveCommand(['r1', 'c1'], { x: 10, y: 10 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(110);
    expect(state.objects[1].x).toBe(210);
  });

  it('MoveCommand with zero delta does not change position', () => {
    const rect = makeRect({ id: 'r1', x: 100, y: 100 });
    state.objects.push(rect);
    const cmd = new MoveCommand(['r1'], { x: 0, y: 0 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(100);
    expect(state.objects[0].y).toBe(100);
  });

  it('MoveCommand with non-existent id does not crash', () => {
    const rect = makeRect({ id: 'r1', x: 100, y: 100 });
    state.objects.push(rect);
    const cmd = new MoveCommand(['nonexistent'], { x: 10, y: 10 });
    const result = cmd.execute(state);
    // Should not crash; rectangle should be unchanged
    expect(state.objects[0].x).toBe(100);
  });

  it('MoveCommand moves triangle points', () => {
    const tri = makeTriangle({ id: 'tri1' });
    state.objects.push(tri);
    const cmd = new MoveCommand(['tri1'], { x: 10, y: 10 });
    cmd.execute(state);
    expect(state.objects[0].points[0].x).toBe(110);
    expect(state.objects[0].points[0].y).toBe(60);
  });
});

/* ================================================================
   D. Resize
   ================================================================ */
describe('Phase 1D — Resize', () => {
  let state;

  beforeEach(() => {
    state = createState();
  });

  it('ResizeCommand scales rectangle width and height', () => {
    const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100 });
    state.objects.push(rect);
    const cmd = new ResizeCommand(['r1'], {
      scaleX: 2,
      scaleY: 2,
      origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].width).toBe(200);
    expect(state.objects[0].height).toBe(200);
  });

  it('ResizeCommand enforces minimum size (MIN_SIZE = 4)', () => {
    const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100 });
    state.objects.push(rect);
    const cmd = new ResizeCommand(['r1'], {
      scaleX: 0.01,
      scaleY: 0.01,
      origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].width).toBeGreaterThanOrEqual(4);
    expect(state.objects[0].height).toBeGreaterThanOrEqual(4);
  });

  it('ResizeCommand undo restores original dimensions', () => {
    const rect = makeRect({ id: 'r1', x: 50, y: 50, width: 100, height: 80 });
    state.objects.push(rect);
    const cmd = new ResizeCommand(['r1'], {
      scaleX: 1.5,
      scaleY: 1.5,
      origin: { x: 50, y: 50 },
    });
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].width).toBe(100);
    expect(state.objects[0].height).toBe(80);
  });

  it('ResizeCommand scales circle radius', () => {
    const circle = makeCircle({ id: 'c1', x: 0, y: 0, radius: 50 });
    state.objects.push(circle);
    const cmd = new ResizeCommand(['c1'], {
      scaleX: 2,
      scaleY: 2,
      origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].radius).toBeGreaterThan(50);
  });

  it('ResizeCommand scales ellipse radii independently', () => {
    const ellipse = makeEllipse({ id: 'e1', x: 0, y: 0, radiusX: 80, radiusY: 40 });
    state.objects.push(ellipse);
    const cmd = new ResizeCommand(['e1'], {
      scaleX: 2,
      scaleY: 1,
      origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].radiusX).toBe(160);
    expect(state.objects[0].radiusY).toBe(40);
  });

  it('ResizeCommand scales line endpoints', () => {
    const line = makeLine({ id: 'l1', x1: 0, y1: 0, x2: 100, y2: 100 });
    state.objects.push(line);
    const cmd = new ResizeCommand(['l1'], {
      scaleX: 2,
      scaleY: 2,
      origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].x2).toBe(200);
    expect(state.objects[0].y2).toBe(200);
  });

  it('ResizeCommand text width/height updated correctly', () => {
    const text = makeText({ id: 't1', x: 0, y: 0, width: 200, height: 50 });
    state.objects.push(text);
    const cmd = new ResizeCommand(['t1'], {
      scaleX: 1.5,
      scaleY: 1.5,
      origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].width).toBeGreaterThan(200);
    // Height is auto-derived from text content, not scaled by scaleY
    // "Hello World" = 1 line → height = fontSize * 1.2 = 19.2
    expect(state.objects[0].height).toBeGreaterThan(0);
    expect(state.objects[0].height).toBeCloseTo(16 * 1.2);
  });

  it('ResizeCommand with non-finite scale returns gracefully', () => {
    const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100 });
    state.objects.push(rect);
    const cmd = new ResizeCommand(['r1'], {
      scaleX: Infinity,
      scaleY: 1,
      origin: { x: 0, y: 0 },
    });
    const result = cmd.execute(state);
    expect(result).toBe(false);
  });

  it('ResizeCommand with no object ids returns false', () => {
    const cmd = new ResizeCommand([], {
      scaleX: 2,
      scaleY: 2,
      origin: { x: 0, y: 0 },
    });
    const result = cmd.execute(state);
    expect(result).toBe(false);
  });

  it('ResizeCommand preserves rotation after resize', () => {
    const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 4 });
    state.objects.push(rect);
    const cmd = new ResizeCommand(['r1'], {
      scaleX: 2,
      scaleY: 2,
      origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].rotation).toBeCloseTo(Math.PI / 4);
  });

  it('ResizeCommand text font scaling with isTextFontResize', () => {
    const text = makeText({ id: 't1', x: 0, y: 0, width: 200, height: 50, fontSize: 16 });
    state.objects.push(text);
    const cmd = new ResizeCommand(['t1'], {
      scaleX: 2,
      scaleY: 2,
      origin: { x: 0, y: 0 },
      isTextFontResize: true,
    });
    cmd.execute(state);
    expect(state.objects[0].fontSize).toBe(32);
  });
});

/* ================================================================
   E. Rotate
   ================================================================ */
describe('Phase 1E — Rotate', () => {
  let state;

  beforeEach(() => {
    state = createState();
  });

  it('RotateCommand sets rotation angle on rectangle', () => {
    const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100, rotation: 0 });
    state.objects.push(rect);
    const center = { x: 50, y: 50 };
    const cmd = new RotateCommand(['r1'], Math.PI / 2, center);
    cmd.execute(state);
    expect(state.objects[0].rotation).toBeCloseTo(Math.PI / 2);
  });

  it('RotateCommand undo restores original angle', () => {
    const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100, rotation: 0 });
    state.objects.push(rect);
    const center = { x: 50, y: 50 };
    const cmd = new RotateCommand(['r1'], Math.PI / 4, center);
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].rotation).toBeCloseTo(0);
    expect(state.objects[0].x).toBeCloseTo(0);
    expect(state.objects[0].y).toBeCloseTo(0);
  });

  it('RotateCommand rotates line endpoints', () => {
    const line = makeLine({ id: 'l1', x1: 0, y1: 0, x2: 100, y2: 0 });
    state.objects.push(line);
    const center = { x: 50, y: 0 };
    const cmd = new RotateCommand(['l1'], Math.PI / 2, center);
    cmd.execute(state);
    // After 90° rotation around (50,0):
    // (0,0) → (50, -50), (100,0) → (50, 50)
    expect(state.objects[0].x1).toBeCloseTo(50);
    expect(state.objects[0].y1).toBeCloseTo(-50);
    expect(state.objects[0].x2).toBeCloseTo(50);
    expect(state.objects[0].y2).toBeCloseTo(50);
  });

  it('RotateCommand rotates drawing points', () => {
    const drawing = makeDrawing({
      id: 'd1',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    });
    state.objects.push(drawing);
    const cmd = new RotateCommand(['d1'], Math.PI, { x: 5, y: 0 });
    cmd.execute(state);
    // 180° rotation around (5,0): (0,0)→(10,0), (10,0)→(0,0)
    expect(state.objects[0].points[0].x).toBeCloseTo(10);
    expect(state.objects[0].points[1].x).toBeCloseTo(0);
  });

  it('RotateCommand rotation persists after move', () => {
    const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100, rotation: 0 });
    state.objects.push(rect);
    const rotateCmd = new RotateCommand(['r1'], Math.PI / 6, { x: 50, y: 50 });
    rotateCmd.execute(state);
    const rotationAfterRotate = state.objects[0].rotation;

    const moveCmd = new MoveCommand(['r1'], { x: 100, y: 100 });
    moveCmd.execute(state);
    // Rotation should not change after move
    expect(state.objects[0].rotation).toBeCloseTo(rotationAfterRotate);
  });

  it('RotateCommand handles multiple objects', () => {
    state.objects.push(makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100, rotation: 0 }));
    state.objects.push(makeRect({ id: 'r2', x: 200, y: 200, width: 50, height: 50, rotation: 0 }));
    const cmd = new RotateCommand(['r1', 'r2'], Math.PI / 4, { x: 100, y: 100 });
    cmd.execute(state);
    expect(state.objects[0].rotation).toBeCloseTo(Math.PI / 4);
    expect(state.objects[1].rotation).toBeCloseTo(Math.PI / 4);
  });

  it('RotateCommand re-execute uses original snapshot (not incremental)', () => {
    const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100, rotation: 0 });
    state.objects.push(rect);
    const cmd = new RotateCommand(['r1'], Math.PI / 4, { x: 50, y: 50 });
    cmd.execute(state);
    const firstRotation = state.objects[0].rotation;
    // Re-execute should produce same result (idempotent from snapshot)
    cmd.execute(state);
    expect(state.objects[0].rotation).toBeCloseTo(firstRotation);
  });
});
