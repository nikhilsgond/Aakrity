/**
 * Sticky Note System — Phase 3 Tests
 *
 * Tests: StickyNoteTool, AddShapeCommand lifecycle, MoveCommand,
 * ResizeCommand, ObjectGeometry, UpdateStyleCommand integration,
 * and edge cases.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import StickyNoteTool, { NOTE_COLORS, DEFAULT_STICKY_SIZE } from '../src/features/canvas/tools/sticky-note/StickyNoteTool';
import { AddShapeCommand } from '../src/features/canvas/engine/commands/ShapeCommands';
import { MoveCommand } from '../src/features/canvas/engine/commands/MoveCommand';
import { ResizeCommand } from '../src/features/canvas/engine/commands/ResizeCommand';
import { UpdateStyleCommand } from '../src/features/canvas/engine/commands/UpdateStyleCommand';
import ObjectGeometry from '../src/features/canvas/engine/geometry/ObjectGeometry';
import { createState } from './helpers';

// Helper
function makeSticky(overrides = {}) {
  return {
    id: 'sticky_1',
    type: 'sticky',
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    text: '',
    noteColor: '#FFF9C4',
    textColor: '#333333',
    fontSize: 16,
    opacity: 1,
    rotation: 0,
    layer: 'default',
    visible: true,
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeMockCanvasManager() {
  return {
    screenToWorld: (cx, cy) => ({ x: cx, y: cy }),
    setSelection: vi.fn(),
    setActiveTool: vi.fn(),
  };
}

// ============================================================
// StickyNoteTool — Core
// ============================================================
describe('StickyNoteTool — Core', () => {
  let tool;
  beforeEach(() => { tool = new StickyNoteTool(); });

  it('has correct name and cursor', () => {
    expect(tool.name).toBe('sticky');
    expect(tool.cursor).toBe('crosshair');
  });

  it('activate sets canvasManager and options', () => {
    const cm = makeMockCanvasManager();
    tool.activate(cm, { noteColor: 'pink' });
    expect(tool.canvasManager).toBe(cm);
    expect(tool.options.noteColor).toBe('pink');
  });

  it('deactivate clears canvasManager', () => {
    tool.activate(makeMockCanvasManager());
    tool.deactivate();
    expect(tool.canvasManager).toBeNull();
  });

  it('setOptions merges new options', () => {
    tool.setOptions({ noteColor: 'blue', fontSize: 24 });
    expect(tool.options.noteColor).toBe('blue');
    expect(tool.options.fontSize).toBe(24);
  });

  it('getUIConfig returns name and cursor', () => {
    const cfg = tool.getUIConfig();
    expect(cfg.name).toBe('sticky');
    expect(cfg.cursor).toBe('crosshair');
  });

  it('default noteColor is yellow', () => {
    expect(tool.options.noteColor).toBe('yellow');
  });

  it('default fontSize is 16', () => {
    expect(tool.options.fontSize).toBe(16);
  });

  it('default opacity is 1.0', () => {
    expect(tool.options.opacity).toBe(1.0);
  });
});

// ============================================================
// StickyNoteTool — Pointer Events
// ============================================================
describe('StickyNoteTool — Pointer Events', () => {
  let tool;
  beforeEach(() => {
    tool = new StickyNoteTool();
    tool.activate(makeMockCanvasManager());
  });

  it('onPointerDown returns a command', () => {
    const result = tool.onPointerDown({ x: 400, y: 300 });
    expect(result).not.toBeNull();
    expect(result.command).toBeDefined();
    expect(result.command).toBeInstanceOf(AddShapeCommand);
  });

  it('created shape is centered on click position', () => {
    const result = tool.onPointerDown({ x: 400, y: 300 });
    const data = result.command.shapeData;
    expect(data.x).toBe(400 - DEFAULT_STICKY_SIZE / 2);
    expect(data.y).toBe(300 - DEFAULT_STICKY_SIZE / 2);
  });

  it('created shape has correct default dimensions (200x200)', () => {
    const result = tool.onPointerDown({ x: 100, y: 100 });
    const data = result.command.shapeData;
    expect(data.width).toBe(DEFAULT_STICKY_SIZE);
    expect(data.height).toBe(DEFAULT_STICKY_SIZE);
  });

  it('created shape type is "sticky"', () => {
    const result = tool.onPointerDown({ x: 0, y: 0 });
    expect(result.command.shapeData.type).toBe('sticky');
  });

  it('created shape has unique ID', () => {
    const r1 = tool.onPointerDown({ x: 10, y: 10 });
    const r2 = tool.onPointerDown({ x: 20, y: 20 });
    expect(r1.command.shapeData.id).not.toBe(r2.command.shapeData.id);
  });

  it('uses yellow palette by default', () => {
    const result = tool.onPointerDown({ x: 0, y: 0 });
    const data = result.command.shapeData;
    expect(data.noteColor).toBe(NOTE_COLORS.yellow.bg);
    expect(data.textColor).toBe(NOTE_COLORS.yellow.text);
  });

  it('respects noteColor option (pink)', () => {
    tool.setOptions({ noteColor: 'pink' });
    const result = tool.onPointerDown({ x: 0, y: 0 });
    expect(result.command.shapeData.noteColor).toBe(NOTE_COLORS.pink.bg);
  });

  it('respects fontSize option', () => {
    tool.setOptions({ fontSize: 24 });
    const result = tool.onPointerDown({ x: 0, y: 0 });
    expect(result.command.shapeData.fontSize).toBe(24);
  });

  it('respects opacity option', () => {
    tool.setOptions({ opacity: 0.7 });
    const result = tool.onPointerDown({ x: 0, y: 0 });
    expect(result.command.shapeData.opacity).toBe(0.7);
  });

  it('onPointerMove returns null', () => {
    expect(tool.onPointerMove()).toBeNull();
  });

  it('onPointerUp returns null', () => {
    expect(tool.onPointerUp()).toBeNull();
  });

  it('returns null when canvasManager is not set', () => {
    tool.deactivate();
    expect(tool.onPointerDown({ x: 0, y: 0 })).toBeNull();
  });

  it('text field defaults to empty string', () => {
    const result = tool.onPointerDown({ x: 0, y: 0 });
    expect(result.command.shapeData.text).toBe('');
  });

  it('placing at negative coordinates works', () => {
    const result = tool.onPointerDown({ x: -100, y: -50 });
    const data = result.command.shapeData;
    expect(data.x).toBe(-100 - DEFAULT_STICKY_SIZE / 2);
    expect(data.y).toBe(-50 - DEFAULT_STICKY_SIZE / 2);
  });
});

// ============================================================
// Sticky — AddShapeCommand Lifecycle
// ============================================================
describe('Sticky — AddShapeCommand Lifecycle', () => {
  let state;
  beforeEach(() => {
    state = createState();
  });

  it('execute adds sticky to state.objects', () => {
    const cmd = new AddShapeCommand(makeSticky());
    cmd.execute(state);
    expect(state.objects.length).toBe(1);
    expect(state.objects[0].type).toBe('sticky');
  });

  it('undo removes sticky from state.objects', () => {
    const cmd = new AddShapeCommand(makeSticky());
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects.length).toBe(0);
  });

  it('execute after undo re-adds sticky (redo)', () => {
    const cmd = new AddShapeCommand(makeSticky());
    cmd.execute(state);
    cmd.undo(state);
    cmd.execute(state);
    expect(state.objects.length).toBe(1);
  });

  it('is idempotent — double execute does not duplicate', () => {
    const cmd = new AddShapeCommand(makeSticky());
    cmd.execute(state);
    cmd.execute(state);
    expect(state.objects.length).toBe(1);
  });

  it('preserves all sticky properties through lifecycle', () => {
    const sticky = makeSticky({ text: 'Hello', noteColor: '#F8BBD0' });
    const cmd = new AddShapeCommand(sticky);
    cmd.execute(state);
    const obj = state.objects[0];
    expect(obj.noteColor).toBe('#F8BBD0');
    expect(obj.text).toBe('Hello');
    expect(obj.fontSize).toBe(16);
  });

  it('serialize / deserialize preserves sticky data', () => {
    const cmd = new AddShapeCommand(makeSticky({ text: 'Test' }));
    const serialized = cmd.serialize();
    const restored = AddShapeCommand.deserialize(serialized);
    expect(restored.shapeData.type).toBe('sticky');
    expect(restored.shapeData.text).toBe('Test');
  });
});

// ============================================================
// Sticky — MoveCommand
// ============================================================
describe('Sticky — MoveCommand', () => {
  let state;
  beforeEach(() => {
    state = createState();
    state.objects.push(makeSticky({ id: 'sticky_1', x: 100, y: 100 }));
  });

  it('moves sticky by delta', () => {
    const cmd = new MoveCommand(['sticky_1'], { x: 50, y: 30 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(150);
    expect(state.objects[0].y).toBe(130);
  });

  it('undo restores original position', () => {
    const cmd = new MoveCommand(['sticky_1'], { x: 50, y: 30 });
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].x).toBe(100);
    expect(state.objects[0].y).toBe(100);
  });

  it('move to negative coordinates works', () => {
    const cmd = new MoveCommand(['sticky_1'], { x: -300, y: -300 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(-200);
    expect(state.objects[0].y).toBe(-200);
  });

  it('zero delta is a no-op', () => {
    const cmd = new MoveCommand(['sticky_1'], { x: 0, y: 0 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(100);
    expect(state.objects[0].y).toBe(100);
  });
});

// ============================================================
// Sticky — ResizeCommand
// ============================================================
describe('Sticky — ResizeCommand', () => {
  let state;
  beforeEach(() => {
    state = createState();
    state.objects.push(makeSticky({ id: 'sticky_1', x: 100, y: 100, width: 200, height: 200 }));
  });

  it('resize scales width and height', () => {
    const cmd = new ResizeCommand(['sticky_1'], {
      origin: { x: 100, y: 100 },
      scaleX: 1.5,
      scaleY: 1.5,
    });
    cmd.execute(state);
    expect(state.objects[0].width).toBe(300);
    expect(state.objects[0].height).toBe(300);
  });

  it('undo restores original dimensions', () => {
    const cmd = new ResizeCommand(['sticky_1'], {
      origin: { x: 100, y: 100 },
      scaleX: 2,
      scaleY: 2,
    });
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].width).toBe(200);
    expect(state.objects[0].height).toBe(200);
  });

  it('resize respects minimum size', () => {
    const cmd = new ResizeCommand(['sticky_1'], {
      origin: { x: 100, y: 100 },
      scaleX: 0.01,
      scaleY: 0.01,
    });
    cmd.execute(state);
    expect(state.objects[0].width).toBeGreaterThanOrEqual(1);
    expect(state.objects[0].height).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// Sticky — ObjectGeometry
// ============================================================
describe('Sticky — ObjectGeometry', () => {
  it('getBounds returns correct bounding box', () => {
    const sticky = makeSticky({ x: 50, y: 60, width: 200, height: 200 });
    const bounds = ObjectGeometry.getBounds(sticky);
    expect(bounds).toEqual({ x: 50, y: 60, width: 200, height: 200 });
  });

  it('hitTest returns true for point inside sticky', () => {
    const sticky = makeSticky({ x: 0, y: 0, width: 200, height: 200 });
    expect(ObjectGeometry.hitTest({ x: 100, y: 100 }, sticky)).toBe(true);
  });

  it('hitTest returns false for point outside sticky', () => {
    const sticky = makeSticky({ x: 0, y: 0, width: 200, height: 200 });
    expect(ObjectGeometry.hitTest({ x: 500, y: 500 }, sticky)).toBe(false);
  });

  it('hitTest returns true for point on edge', () => {
    const sticky = makeSticky({ x: 0, y: 0, width: 200, height: 200 });
    expect(ObjectGeometry.hitTest({ x: 0, y: 100 }, sticky)).toBe(true);
  });

  it('hitTest with tolerance catches near-miss', () => {
    const sticky = makeSticky({ x: 0, y: 0, width: 200, height: 200 });
    expect(ObjectGeometry.hitTest({ x: -3, y: 100 }, sticky, 5)).toBe(true);
  });

  it('intersectsRect true for overlapping rect', () => {
    const sticky = makeSticky({ x: 0, y: 0, width: 200, height: 200 });
    expect(ObjectGeometry.intersectsRect(sticky, { x: 150, y: 150, width: 100, height: 100 })).toBe(true);
  });

  it('intersectsRect false for non-overlapping rect', () => {
    const sticky = makeSticky({ x: 0, y: 0, width: 200, height: 200 });
    expect(ObjectGeometry.intersectsRect(sticky, { x: 500, y: 500, width: 50, height: 50 })).toBe(false);
  });

  it('getBounds returns null for null object', () => {
    expect(ObjectGeometry.getBounds(null)).toBeNull();
  });

  it('hitTest returns false for null object', () => {
    expect(ObjectGeometry.hitTest({ x: 0, y: 0 }, null)).toBe(false);
  });
});

// ============================================================
// Sticky — UpdateStyleCommand integration
// ============================================================
describe('Sticky — UpdateStyleCommand', () => {
  let state;
  beforeEach(() => {
    state = createState();
    state.objects.push(makeSticky({ id: 'sticky_1', noteColor: '#FFF9C4', opacity: 1 }));
  });

  it('changes noteColor', () => {
    const cmd = new UpdateStyleCommand(['sticky_1'], { noteColor: '#F8BBD0' });
    cmd.execute(state);
    expect(state.objects[0].noteColor).toBe('#F8BBD0');
  });

  it('undo restores noteColor', () => {
    const cmd = new UpdateStyleCommand(['sticky_1'], { noteColor: '#F8BBD0' });
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].noteColor).toBe('#FFF9C4');
  });

  it('changes opacity', () => {
    const cmd = new UpdateStyleCommand(['sticky_1'], { opacity: 0.5 });
    cmd.execute(state);
    expect(state.objects[0].opacity).toBe(0.5);
  });

  it('changes textColor', () => {
    const cmd = new UpdateStyleCommand(['sticky_1'], { textColor: '#FF0000' });
    cmd.execute(state);
    expect(state.objects[0].textColor).toBe('#FF0000');
  });

  it('changes fontSize', () => {
    const cmd = new UpdateStyleCommand(['sticky_1'], { fontSize: 24 });
    cmd.execute(state);
    expect(state.objects[0].fontSize).toBe(24);
  });

  it('changes text content', () => {
    const cmd = new UpdateStyleCommand(['sticky_1'], { text: 'Hello World' });
    cmd.execute(state);
    expect(state.objects[0].text).toBe('Hello World');
  });

  it('multiple properties at once', () => {
    const cmd = new UpdateStyleCommand(['sticky_1'], { noteColor: '#BBDEFB', textColor: '#000000', fontSize: 20 });
    cmd.execute(state);
    expect(state.objects[0].noteColor).toBe('#BBDEFB');
    expect(state.objects[0].textColor).toBe('#000000');
    expect(state.objects[0].fontSize).toBe(20);
  });
});

// ============================================================
// Sticky — NOTE_COLORS export
// ============================================================
describe('Sticky — NOTE_COLORS', () => {
  it('has 12 color keys', () => {
    expect(Object.keys(NOTE_COLORS).length).toBe(12);
  });

  it('each entry has bg and text properties', () => {
    for (const key of Object.keys(NOTE_COLORS)) {
      expect(NOTE_COLORS[key]).toHaveProperty('bg');
      expect(NOTE_COLORS[key]).toHaveProperty('text');
    }
  });

  it('DEFAULT_STICKY_SIZE is 200', () => {
    expect(DEFAULT_STICKY_SIZE).toBe(200);
  });
});

// ============================================================
// Edge Cases & Integration
// ============================================================
describe('Sticky — Edge Cases & Integration', () => {
  it('multiple stickies can coexist', () => {
    const state = createState();
    const cmd1 = new AddShapeCommand(makeSticky({ id: 's1' }));
    const cmd2 = new AddShapeCommand(makeSticky({ id: 's2' }));
    cmd1.execute(state);
    cmd2.execute(state);
    expect(state.objects.length).toBe(2);
  });

  it('undo chain removes stickies in reverse order', () => {
    const state = createState();
    const cmd1 = new AddShapeCommand(makeSticky({ id: 's1' }));
    const cmd2 = new AddShapeCommand(makeSticky({ id: 's2' }));
    cmd1.execute(state);
    cmd2.execute(state);
    cmd2.undo(state);
    expect(state.objects.length).toBe(1);
    expect(state.objects[0].id).toBe('s1');
  });

  it('sticky with long text is stored in full', () => {
    const longText = 'A'.repeat(1000);
    const state = createState();
    const cmd = new AddShapeCommand(makeSticky({ text: longText }));
    cmd.execute(state);
    expect(state.objects[0].text).toBe(longText);
    expect(state.objects[0].text.length).toBe(1000);
  });

  it('sticky with zero opacity is still in state', () => {
    const state = createState();
    const cmd = new AddShapeCommand(makeSticky({ opacity: 0 }));
    cmd.execute(state);
    expect(state.objects.length).toBe(1);
    expect(state.objects[0].opacity).toBe(0);
  });

  it('changing noteColor between placements uses new color', () => {
    const tool = new StickyNoteTool();
    tool.activate(makeMockCanvasManager());
    tool.setOptions({ noteColor: 'blue' });
    const r1 = tool.onPointerDown({ x: 100, y: 100 });
    expect(r1.command.shapeData.noteColor).toBe(NOTE_COLORS.blue.bg);

    tool.setOptions({ noteColor: 'orange' });
    const r2 = tool.onPointerDown({ x: 200, y: 200 });
    expect(r2.command.shapeData.noteColor).toBe(NOTE_COLORS.orange.bg);
  });

  it('getBounds after move is correct', () => {
    const state = createState();
    state.objects.push(makeSticky({ id: 's1', x: 0, y: 0, width: 200, height: 200 }));
    const cmd = new MoveCommand(['s1'], { x: 100, y: 50 });
    cmd.execute(state);
    const bounds = ObjectGeometry.getBounds(state.objects[0]);
    expect(bounds).toEqual({ x: 100, y: 50, width: 200, height: 200 });
  });

  it('hitTest after move correctly uses new position', () => {
    const state = createState();
    state.objects.push(makeSticky({ id: 's1', x: 0, y: 0, width: 200, height: 200 }));
    const cmd = new MoveCommand(['s1'], { x: 500, y: 500 });
    cmd.execute(state);
    // Old position should miss
    expect(ObjectGeometry.hitTest({ x: 100, y: 100 }, state.objects[0])).toBe(false);
    // New position should hit
    expect(ObjectGeometry.hitTest({ x: 600, y: 600 }, state.objects[0])).toBe(true);
  });

  it('invalid noteColor key falls back to yellow', () => {
    const tool = new StickyNoteTool();
    tool.activate(makeMockCanvasManager());
    tool.setOptions({ noteColor: 'nonexistent' });
    const result = tool.onPointerDown({ x: 0, y: 0 });
    // Fallback to yellow palette
    expect(result.command.shapeData.noteColor).toBe(NOTE_COLORS.yellow.bg);
  });

  it('large number of stickies does not break state', () => {
    const state = createState();
    for (let i = 0; i < 100; i++) {
      const cmd = new AddShapeCommand(makeSticky({ id: `s_${i}` }));
      cmd.execute(state);
    }
    expect(state.objects.length).toBe(100);
  });
});
