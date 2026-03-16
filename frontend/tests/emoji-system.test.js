/**
 * Emoji Tool System Tests
 * ──────────────────────────────────────────────────────────────────────
 *  1. EmojiTool — creation, options, pointer events, edge cases
 *  2. AddShapeCommand — emoji object lifecycle (add / undo / redo / serialize)
 *  3. MoveCommand — emoji move via XY_TYPES path
 *  4. ResizeCommand — emoji resize via rectangle path
 *  5. ObjectGeometry — emoji getBounds, hitTest, intersectsRect
 *  6. Integration — multiple emojis, undo chains, edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import EmojiTool from '../src/features/canvas/tools/emoji/EmojiTool.js';
import { AddShapeCommand } from '../src/features/canvas/engine/commands/ShapeCommands.js';
import { MoveCommand } from '../src/features/canvas/engine/commands/MoveCommand.js';
import { ResizeCommand } from '../src/features/canvas/engine/commands/ResizeCommand.js';
import ObjectGeometry from '../src/features/canvas/engine/geometry/ObjectGeometry.js';
import { createState } from './helpers.js';

/* ================================================================
   HELPERS
   ================================================================ */

function makeEmoji(overrides = {}) {
  return {
    id: overrides.id || 'emoji_1',
    type: 'emoji',
    x: 100,
    y: 100,
    width: 64,
    height: 64,
    emoji: '😀',
    rotation: 0,
    opacity: 1.0,
    visible: true,
    lockedBy: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

function createMockCanvasManager(stateOverrides = {}) {
  const state = createState(stateOverrides);
  return {
    state,
    requestRender: vi.fn(),
    emit: vi.fn(),
    setSelection: vi.fn(),
    setActiveTool: vi.fn(),
    toolManager: {
      getToolInstance: vi.fn(() => ({ name: 'select' })),
    },
  };
}

/* ================================================================
   1. EmojiTool — Core Tool Behavior
   ================================================================ */
describe('Emoji Tool — Core', () => {
  let tool;
  let cm;

  beforeEach(() => {
    tool = new EmojiTool();
    cm = createMockCanvasManager();
    tool.activate(cm, { emoji: '🔥' });
  });

  it('has correct name and cursor', () => {
    expect(tool.name).toBe('emoji');
    expect(tool.cursor).toBe('crosshair');
  });

  it('activate sets canvasManager and tool options', () => {
    expect(tool.canvasManager).toBe(cm);
    expect(tool.options.emoji).toBe('🔥');
  });

  it('deactivate clears canvasManager', () => {
    tool.deactivate();
    expect(tool.canvasManager).toBe(null);
  });

  it('setOptions merges new options', () => {
    tool.setOptions({ emoji: '💎', opacity: 0.5 });
    expect(tool.options.emoji).toBe('💎');
    expect(tool.options.opacity).toBe(0.5);
  });

  it('getUIConfig returns name and cursor', () => {
    const config = tool.getUIConfig();
    expect(config.name).toBe('emoji');
    expect(config.cursor).toBe('crosshair');
  });

  it('default emoji is 😀 when no options provided', () => {
    const defaultTool = new EmojiTool();
    expect(defaultTool.options.emoji).toBe('😀');
  });

  it('default opacity is 1.0 when not specified', () => {
    const defaultTool = new EmojiTool();
    expect(defaultTool.options.opacity).toBe(1.0);
  });
});

/* ================================================================
   2. EmojiTool — Pointer Events
   ================================================================ */
describe('Emoji Tool — Pointer Events', () => {
  let tool;
  let cm;

  beforeEach(() => {
    tool = new EmojiTool();
    cm = createMockCanvasManager();
    tool.activate(cm, { emoji: '⭐' });
  });

  it('onPointerDown returns a command', () => {
    const result = tool.onPointerDown({ x: 200, y: 300 });
    expect(result).not.toBeNull();
    expect(result.command).toBeInstanceOf(AddShapeCommand);
  });

  it('created shape is centered on click position', () => {
    const result = tool.onPointerDown({ x: 200, y: 300 });
    const cmd = result.command;
    // Click at 200,300 => centered means x=200-32=168, y=300-32=268
    expect(cmd.shapeData.x).toBe(168);
    expect(cmd.shapeData.y).toBe(268);
  });

  it('created shape uses selected emoji from options', () => {
    const result = tool.onPointerDown({ x: 100, y: 100 });
    expect(result.command.shapeData.emoji).toBe('⭐');
  });

  it('created shape has correct default dimensions (64x64)', () => {
    const result = tool.onPointerDown({ x: 100, y: 100 });
    expect(result.command.shapeData.width).toBe(64);
    expect(result.command.shapeData.height).toBe(64);
  });

  it('created shape type is "emoji"', () => {
    const result = tool.onPointerDown({ x: 100, y: 100 });
    expect(result.command.shapeData.type).toBe('emoji');
  });

  it('created shape has unique ID', () => {
    const result1 = tool.onPointerDown({ x: 100, y: 100 });
    const result2 = tool.onPointerDown({ x: 200, y: 200 });
    expect(result1.command.objectId).not.toBe(result2.command.objectId);
  });

  it('created shape respects opacity option', () => {
    tool.setOptions({ opacity: 0.5 });
    const result = tool.onPointerDown({ x: 100, y: 100 });
    expect(result.command.shapeData.opacity).toBe(0.5);
  });

  it('onPointerMove returns null (no drag behavior)', () => {
    expect(tool.onPointerMove({ x: 100, y: 100 })).toBeNull();
  });

  it('onPointerUp returns null', () => {
    expect(tool.onPointerUp({ x: 100, y: 100 })).toBeNull();
  });

  it('returns null when canvasManager is not set', () => {
    tool.deactivate();
    const result = tool.onPointerDown({ x: 100, y: 100 });
    expect(result).toBeNull();
  });

  it('placing emoji at 0,0 centers correctly (negative coords)', () => {
    const result = tool.onPointerDown({ x: 0, y: 0 });
    expect(result.command.shapeData.x).toBe(-32);
    expect(result.command.shapeData.y).toBe(-32);
  });

  it('placing emoji at negative coords works', () => {
    const result = tool.onPointerDown({ x: -100, y: -50 });
    expect(result.command.shapeData.x).toBe(-132);
    expect(result.command.shapeData.y).toBe(-82);
  });
});

/* ================================================================
   3. AddShapeCommand — Emoji Object Lifecycle
   ================================================================ */
describe('Emoji — AddShapeCommand Lifecycle', () => {
  let state;

  beforeEach(() => {
    state = createState();
  });

  it('execute adds emoji to state.objects', () => {
    const emoji = makeEmoji();
    const cmd = new AddShapeCommand(emoji);
    cmd.execute(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].type).toBe('emoji');
    expect(state.objects[0].emoji).toBe('😀');
  });

  it('undo removes emoji from state.objects', () => {
    const emoji = makeEmoji();
    const cmd = new AddShapeCommand(emoji);
    cmd.execute(state);
    expect(state.objects).toHaveLength(1);
    cmd.undo(state);
    expect(state.objects).toHaveLength(0);
  });

  it('execute after undo re-adds emoji (redo)', () => {
    const emoji = makeEmoji();
    const cmd = new AddShapeCommand(emoji);
    cmd.execute(state);
    cmd.undo(state);
    cmd.execute(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].emoji).toBe('😀');
  });

  it('is idempotent — double execute does not duplicate', () => {
    const emoji = makeEmoji();
    const cmd = new AddShapeCommand(emoji);
    cmd.execute(state);
    cmd.execute(state);
    expect(state.objects).toHaveLength(1);
  });

  it('serialize / deserialize preserves emoji data', () => {
    const emoji = makeEmoji({ emoji: '🚀' });
    const cmd = new AddShapeCommand(emoji);
    const serialized = cmd.serialize();
    expect(serialized.type).toBe('AddShapeCommand');
    expect(serialized.shapeData.emoji).toBe('🚀');
    expect(serialized.shapeData.type).toBe('emoji');

    const restored = AddShapeCommand.deserialize(serialized);
    expect(restored.shapeData.emoji).toBe('🚀');
    expect(restored.objectId).toBe('emoji_1');
  });

  it('preserves all emoji properties through lifecycle', () => {
    const emoji = makeEmoji({ emoji: '💯', opacity: 0.7, rotation: 0.5 });
    const cmd = new AddShapeCommand(emoji);
    cmd.execute(state);

    const obj = state.objects[0];
    expect(obj.emoji).toBe('💯');
    expect(obj.opacity).toBe(0.7);
    expect(obj.rotation).toBe(0.5);
    expect(obj.width).toBe(64);
    expect(obj.height).toBe(64);
  });
});

/* ================================================================
   4. MoveCommand — Emoji Movement
   ================================================================ */
describe('Emoji — MoveCommand', () => {
  let state;

  beforeEach(() => {
    state = createState();
    state.objects.push(makeEmoji());
  });

  it('moves emoji by delta', () => {
    const cmd = new MoveCommand(['emoji_1'], { x: 50, y: 30 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(150);
    expect(state.objects[0].y).toBe(130);
  });

  it('undo restores original position', () => {
    const cmd = new MoveCommand(['emoji_1'], { x: 50, y: 30 });
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].x).toBe(100);
    expect(state.objects[0].y).toBe(100);
  });

  it('re-execute after undo re-applies delta', () => {
    const cmd = new MoveCommand(['emoji_1'], { x: 50, y: 30 });
    cmd.execute(state);
    cmd.undo(state);
    // BaseCommand has no redo(); re-execute applies delta from captured initialPositions
    cmd.execute(state);
    expect(state.objects[0].x).toBe(150);
    expect(state.objects[0].y).toBe(130);
  });

  it('moves multiple emojis at once', () => {
    state.objects.push(makeEmoji({ id: 'emoji_2', x: 300, y: 300 }));
    const cmd = new MoveCommand(['emoji_1', 'emoji_2'], { x: -20, y: 10 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(80);
    expect(state.objects[0].y).toBe(110);
    expect(state.objects[1].x).toBe(280);
    expect(state.objects[1].y).toBe(310);
  });

  it('move to negative coordinates works', () => {
    const cmd = new MoveCommand(['emoji_1'], { x: -200, y: -200 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(-100);
    expect(state.objects[0].y).toBe(-100);
  });

  it('zero delta move is a no-op', () => {
    const cmd = new MoveCommand(['emoji_1'], { x: 0, y: 0 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(100);
    expect(state.objects[0].y).toBe(100);
  });
});

/* ================================================================
   5. ResizeCommand — Emoji Resize
   ================================================================ */
describe('Emoji — ResizeCommand', () => {
  let state;

  beforeEach(() => {
    state = createState();
    state.objects.push(makeEmoji());
  });

  it('resize scales emoji width and height', () => {
    const cmd = new ResizeCommand(
      ['emoji_1'],
      { origin: { x: 100, y: 100 }, scaleX: 2.0, scaleY: 2.0 }
    );
    cmd.execute(state);
    // Original: x=100, y=100, w=64, h=64
    // Origin at top-left (100,100), scale 2x:
    // left=100 => 100+(100-100)*2=100, right=164 => 100+(164-100)*2=228
    // so x=100, width=128
    expect(state.objects[0].width).toBe(128);
    expect(state.objects[0].height).toBe(128);
  });

  it('resize respects minimum size', () => {
    const cmd = new ResizeCommand(
      ['emoji_1'],
      { origin: { x: 100, y: 100 }, scaleX: 0.001, scaleY: 0.001 }
    );
    cmd.execute(state);
    // Should not go below MIN_SIZE (4)
    expect(state.objects[0].width).toBeGreaterThanOrEqual(4);
    expect(state.objects[0].height).toBeGreaterThanOrEqual(4);
  });

  it('undo restores original dimensions', () => {
    const cmd = new ResizeCommand(
      ['emoji_1'],
      { origin: { x: 100, y: 100 }, scaleX: 2.0, scaleY: 2.0 }
    );
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].width).toBe(64);
    expect(state.objects[0].height).toBe(64);
    expect(state.objects[0].x).toBe(100);
    expect(state.objects[0].y).toBe(100);
  });
});

/* ================================================================
   6. ObjectGeometry — Emoji Hit Testing
   ================================================================ */
describe('Emoji — ObjectGeometry', () => {
  it('getBounds returns correct bounding box', () => {
    const emoji = makeEmoji({ x: 50, y: 60, width: 64, height: 64 });
    const bounds = ObjectGeometry.getBounds(emoji);
    expect(bounds).not.toBeNull();
    expect(bounds.x).toBe(50);
    expect(bounds.y).toBe(60);
    expect(bounds.width).toBe(64);
    expect(bounds.height).toBe(64);
  });

  it('hitTest returns true for point inside emoji', () => {
    const emoji = makeEmoji({ x: 100, y: 100, width: 64, height: 64 });
    // Center point
    const hit = ObjectGeometry.hitTest({ x: 132, y: 132 }, emoji);
    expect(hit).toBe(true);
  });

  it('hitTest returns false for point outside emoji', () => {
    const emoji = makeEmoji({ x: 100, y: 100, width: 64, height: 64 });
    const hit = ObjectGeometry.hitTest({ x: 0, y: 0 }, emoji);
    expect(hit).toBe(false);
  });

  it('hitTest returns true for point on edge', () => {
    const emoji = makeEmoji({ x: 100, y: 100, width: 64, height: 64 });
    // On the top-left corner
    const hit = ObjectGeometry.hitTest({ x: 100, y: 100 }, emoji);
    expect(hit).toBe(true);
  });

  it('hitTest with tolerance catches near-miss', () => {
    const emoji = makeEmoji({ x: 100, y: 100, width: 64, height: 64 });
    // 3px outside the right edge
    const hit = ObjectGeometry.hitTest({ x: 167, y: 132 }, emoji, 5);
    expect(hit).toBe(true);
  });

  it('intersectsRect returns true for overlapping rect', () => {
    const emoji = makeEmoji({ x: 100, y: 100, width: 64, height: 64 });
    const hit = ObjectGeometry.intersectsRect(emoji, { x: 120, y: 120, width: 50, height: 50 });
    expect(hit).toBe(true);
  });

  it('intersectsRect returns false for non-overlapping rect', () => {
    const emoji = makeEmoji({ x: 100, y: 100, width: 64, height: 64 });
    const hit = ObjectGeometry.intersectsRect(emoji, { x: 500, y: 500, width: 50, height: 50 });
    expect(hit).toBe(false);
  });

  it('getBounds returns null for null object', () => {
    expect(ObjectGeometry.getBounds(null)).toBeNull();
  });

  it('hitTest returns false for null object', () => {
    expect(ObjectGeometry.hitTest({ x: 0, y: 0 }, null)).toBe(false);
  });
});

/* ================================================================
   7. Integration — Multi-Object & Edge Cases
   ================================================================ */
describe('Emoji — Integration & Edge Cases', () => {
  let state;

  beforeEach(() => {
    state = createState();
  });

  it('multiple emojis can coexist in state', () => {
    const cmd1 = new AddShapeCommand(makeEmoji({ id: 'e1', emoji: '😀' }));
    const cmd2 = new AddShapeCommand(makeEmoji({ id: 'e2', emoji: '🔥', x: 200 }));
    const cmd3 = new AddShapeCommand(makeEmoji({ id: 'e3', emoji: '💎', x: 300 }));
    cmd1.execute(state);
    cmd2.execute(state);
    cmd3.execute(state);
    expect(state.objects).toHaveLength(3);
    expect(state.objects.map(o => o.emoji)).toEqual(['😀', '🔥', '💎']);
  });

  it('undo chain removes emojis in reverse order', () => {
    const cmd1 = new AddShapeCommand(makeEmoji({ id: 'e1' }));
    const cmd2 = new AddShapeCommand(makeEmoji({ id: 'e2' }));
    cmd1.execute(state);
    cmd2.execute(state);
    expect(state.objects).toHaveLength(2);

    cmd2.undo(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].id).toBe('e1');

    cmd1.undo(state);
    expect(state.objects).toHaveLength(0);
  });

  it('emoji with lockedBy cannot be overwritten (preserved through add/undo cycle)', () => {
    const emoji = makeEmoji({ lockedBy: 'user_abc' });
    const cmd = new AddShapeCommand(emoji);
    cmd.execute(state);
    expect(state.objects[0].lockedBy).toBe('user_abc');
    cmd.undo(state);
    cmd.execute(state);
    expect(state.objects[0].lockedBy).toBe('user_abc');
  });

  it('emoji with zero opacity is still in state', () => {
    const emoji = makeEmoji({ opacity: 0 });
    const cmd = new AddShapeCommand(emoji);
    cmd.execute(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].opacity).toBe(0);
  });

  it('emoji with special unicode characters works', () => {
    const specialEmojis = ['🏳️‍🌈', '👨‍👩‍👧‍👦', '🧑‍💻', '1️⃣'];
    specialEmojis.forEach((emoji, i) => {
      const cmd = new AddShapeCommand(makeEmoji({ id: `e_${i}`, emoji }));
      cmd.execute(state);
    });
    expect(state.objects).toHaveLength(4);
    expect(state.objects[0].emoji).toBe('🏳️‍🌈');
    expect(state.objects[3].emoji).toBe('1️⃣');
  });

  it('EmojiTool changing options between placements uses new emoji', () => {
    const tool = new EmojiTool();
    const cm = createMockCanvasManager();
    tool.activate(cm, { emoji: '😀' });

    const r1 = tool.onPointerDown({ x: 100, y: 100 });
    expect(r1.command.shapeData.emoji).toBe('😀');

    tool.setOptions({ emoji: '🚀' });
    const r2 = tool.onPointerDown({ x: 200, y: 200 });
    expect(r2.command.shapeData.emoji).toBe('🚀');
  });

  it('emoji getBounds after move is correct', () => {
    state.objects.push(makeEmoji());
    const cmd = new MoveCommand(['emoji_1'], { x: 100, y: 50 });
    cmd.execute(state);

    const bounds = ObjectGeometry.getBounds(state.objects[0]);
    expect(bounds.x).toBe(200);
    expect(bounds.y).toBe(150);
    expect(bounds.width).toBe(64);
    expect(bounds.height).toBe(64);
  });

  it('emoji hitTest after move correctly uses new position', () => {
    state.objects.push(makeEmoji());
    const cmd = new MoveCommand(['emoji_1'], { x: 100, y: 100 });
    cmd.execute(state);

    // New position: x=200, y=200, w=64, h=64
    expect(ObjectGeometry.hitTest({ x: 232, y: 232 }, state.objects[0])).toBe(true);
    // Old position should miss
    expect(ObjectGeometry.hitTest({ x: 100, y: 100 }, state.objects[0])).toBe(false);
  });

  it('large number of emojis does not break state', () => {
    for (let i = 0; i < 100; i++) {
      const cmd = new AddShapeCommand(makeEmoji({ id: `e_${i}`, x: i * 10, y: i * 10 }));
      cmd.execute(state);
    }
    expect(state.objects).toHaveLength(100);
  });
});
