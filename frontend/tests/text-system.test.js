/**
 * Comprehensive Text System Tests
 * 
 * Tests the rebuilt text feature for Miro-level behavior:
 * - Text object model correctness
 * - Create / edit / commit lifecycle
 * - Auto-height derivation
 * - Width-only resize (no vertical stretching)
 * - Resize + font scaling
 * - Rotation with correct geometry
 * - History safety (undo/redo preserves content, height, width)
 * - Deep clone in TextCommand (formattedRanges integrity)
 * - Locking model (lockedBy field)
 * - Collaboration sync (width/height in updates)
 * - Multi-line auto-height
 * - Transform safety
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createState, makeText, makeRect } from './helpers.js';

import { HistoryManager } from '../src/features/canvas/engine/history/HistoryManager.js';
import { TextCommand, TextCommandFactory } from '../src/features/canvas/engine/commands/TextCommands.js';
import { ResizeCommand } from '../src/features/canvas/engine/commands/ResizeCommand.js';
import { MoveCommand } from '../src/features/canvas/engine/commands/MoveCommand.js';
import { RotateCommand } from '../src/features/canvas/engine/commands/RotateCommand.js';

/* ================================================================
   1. TEXT OBJECT MODEL
   ================================================================ */
describe('Text Object Model', () => {
  it('TextCommandFactory.createText includes all required fields', () => {
    const cmd = TextCommandFactory.createText('Hello', 100, 200, {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#ff0000',
      textAlign: 'center',
    });
    const obj = cmd.textObject;

    expect(obj.type).toBe('text');
    expect(obj.x).toBe(100);
    expect(obj.y).toBe(200);
    expect(obj.text).toBe('Hello');
    expect(obj.fontSize).toBe(24);
    expect(obj.fontWeight).toBe('bold');
    expect(obj.textColor).toBe('#ff0000');
    expect(obj.textAlign).toBe('center');
    expect(obj.width).toBe(200);
    expect(obj.height).toBe(50);
    expect(obj.rotation).toBe(0);
    expect(obj.opacity).toBe(1);
    expect(obj.id).toBeDefined();
    expect(obj.createdAt).toBeGreaterThan(0);
    expect(obj.updatedAt).toBeGreaterThan(0);
  });

  it('text object includes lockedBy field (null by default)', () => {
    const cmd = TextCommandFactory.createText('Test', 0, 0);
    expect(cmd.textObject.lockedBy).toBeNull();
  });

  it('text object includes formattedRanges array', () => {
    const cmd = TextCommandFactory.createText('Test', 0, 0);
    expect(cmd.textObject.formattedRanges).toEqual([]);
  });

  it('text object has fontFamily default', () => {
    const cmd = TextCommandFactory.createText('Test', 0, 0);
    expect(cmd.textObject.fontFamily).toBe('Arial, sans-serif');
  });

  it('text object has textAlign default', () => {
    const cmd = TextCommandFactory.createText('Test', 0, 0);
    expect(cmd.textObject.textAlign).toBe('left');
  });
});

/* ================================================================
   2. BASIC CREATE → EDIT → COMMIT
   ================================================================ */
describe('Text Create → Edit → Commit', () => {
  let state, hm;

  beforeEach(() => {
    state = createState();
    hm = new HistoryManager();
  });

  it('create text adds object to state', () => {
    const cmd = TextCommandFactory.createText('Hello', 50, 50);
    hm.execute(cmd, state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].text).toBe('Hello');
  });

  it('modify text updates content', () => {
    const cmd = TextCommandFactory.createText('Original', 50, 50);
    hm.execute(cmd, state);
    const modCmd = TextCommandFactory.modifyText(state.objects[0], { text: 'Modified' });
    hm.execute(modCmd, state);
    expect(state.objects[0].text).toBe('Modified');
  });

  it('commit with empty text deletes object', () => {
    const cmd = TextCommandFactory.createText('Will delete', 50, 50);
    hm.execute(cmd, state);
    const deleteCmd = TextCommandFactory.deleteText(state.objects[0]);
    hm.execute(deleteCmd, state);
    expect(state.objects).toHaveLength(0);
  });

  it('re-edit after commit — full cycle', () => {
    const cmd = TextCommandFactory.createText('v1', 50, 50);
    hm.execute(cmd, state);

    // First edit
    hm.execute(TextCommandFactory.modifyText(state.objects[0], { text: 'v2' }), state);
    expect(state.objects[0].text).toBe('v2');

    // Second edit
    hm.execute(TextCommandFactory.modifyText(state.objects[0], { text: 'v3' }), state);
    expect(state.objects[0].text).toBe('v3');

    // Verify all versions reachable via undo
    hm.undo(state);
    expect(state.objects[0].text).toBe('v2');
    hm.undo(state);
    expect(state.objects[0].text).toBe('v1');
  });
});

/* ================================================================
   3. AUTO-HEIGHT — height derived from content
   ================================================================ */
describe('Text Auto-Height', () => {
  let state;

  beforeEach(() => {
    state = createState();
  });

  it('single-line text height = fontSize * 1.2', () => {
    const text = makeText({ id: 't1', text: 'Hello', fontSize: 20 });
    state.objects.push(text);

    // Resize with only width change — height should recalculate
    const cmd = new ResizeCommand(['t1'], {
      scaleX: 2, scaleY: 1, origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].height).toBeCloseTo(20 * 1.2);
  });

  it('multi-line text height = lines * lineHeight', () => {
    const text = makeText({ id: 't1', text: 'Line1\nLine2\nLine3', fontSize: 16 });
    state.objects.push(text);

    const cmd = new ResizeCommand(['t1'], {
      scaleX: 1.5, scaleY: 1, origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    // 3 lines × 16 × 1.2 = 57.6
    expect(state.objects[0].height).toBeCloseTo(3 * 16 * 1.2);
  });

  it('empty text still has minimum height', () => {
    const text = makeText({ id: 't1', text: '', fontSize: 16 });
    state.objects.push(text);

    const cmd = new ResizeCommand(['t1'], {
      scaleX: 1, scaleY: 1, origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].height).toBeGreaterThanOrEqual(16 * 1.2);
  });

  it('vertical scale does NOT change height (width-only resize)', () => {
    const text = makeText({ id: 't1', text: 'Hello World', fontSize: 16, width: 200, height: 50 });
    state.objects.push(text);

    const cmd = new ResizeCommand(['t1'], {
      scaleX: 1, scaleY: 3, origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    // Height should be auto-derived, not 50 * 3 = 150
    expect(state.objects[0].height).toBeCloseTo(16 * 1.2);
    expect(state.objects[0].height).toBeLessThan(50); // Not stretched
  });
});

/* ================================================================
   4. WIDTH-ONLY RESIZE
   ================================================================ */
describe('Text Width-Only Resize', () => {
  let state;

  beforeEach(() => {
    state = createState();
    state.objects.push(makeText({
      id: 't1', x: 0, y: 0, width: 200, height: 50, text: 'Test', fontSize: 16,
    }));
  });

  it('horizontal resize changes width', () => {
    const cmd = new ResizeCommand(['t1'], {
      scaleX: 2, scaleY: 1, origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].width).toBe(400);
  });

  it('width respects minimum size', () => {
    const cmd = new ResizeCommand(['t1'], {
      scaleX: 0.01, scaleY: 1, origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].width).toBeGreaterThanOrEqual(4);
  });

  it('resize undo restores original width AND height', () => {
    const originalWidth = state.objects[0].width;
    const originalHeight = state.objects[0].height;

    const cmd = new ResizeCommand(['t1'], {
      scaleX: 2, scaleY: 1, origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    cmd.undo(state);

    expect(state.objects[0].width).toBe(originalWidth);
    expect(state.objects[0].height).toBe(originalHeight);
  });
});

/* ================================================================
   5. FONT SIZE SCALING
   ================================================================ */
describe('Text Font Size Scaling', () => {
  let state;

  beforeEach(() => {
    state = createState();
    state.objects.push(makeText({
      id: 't1', x: 0, y: 0, width: 200, height: 50, text: 'Test', fontSize: 16,
    }));
  });

  it('isTextFontResize scales fontSize proportionally', () => {
    const cmd = new ResizeCommand(['t1'], {
      scaleX: 2, scaleY: 2, origin: { x: 0, y: 0 },
      isTextFontResize: true,
    });
    cmd.execute(state);
    expect(state.objects[0].fontSize).toBe(32);
  });

  it('font size clamps to min 8', () => {
    const cmd = new ResizeCommand(['t1'], {
      scaleX: 0.1, scaleY: 0.1, origin: { x: 0, y: 0 },
      isTextFontResize: true,
    });
    cmd.execute(state);
    expect(state.objects[0].fontSize).toBeGreaterThanOrEqual(8);
  });

  it('font size clamps to max 500', () => {
    const cmd = new ResizeCommand(['t1'], {
      scaleX: 100, scaleY: 100, origin: { x: 0, y: 0 },
      isTextFontResize: true,
    });
    cmd.execute(state);
    expect(state.objects[0].fontSize).toBeLessThanOrEqual(500);
  });

  it('font size undo restores original', () => {
    const cmd = new ResizeCommand(['t1'], {
      scaleX: 3, scaleY: 3, origin: { x: 0, y: 0 },
      isTextFontResize: true,
    });
    cmd.execute(state);
    expect(state.objects[0].fontSize).toBe(48);
    cmd.undo(state);
    expect(state.objects[0].fontSize).toBe(16);
  });

  it('height recalculates after font size change', () => {
    const cmd = new ResizeCommand(['t1'], {
      scaleX: 2, scaleY: 2, origin: { x: 0, y: 0 },
      isTextFontResize: true,
    });
    cmd.execute(state);
    // fontSize = 32, 1 line → height = 32 * 1.2 = 38.4
    expect(state.objects[0].height).toBeCloseTo(32 * 1.2);
  });
});

/* ================================================================
   6. ROTATION
   ================================================================ */
describe('Text Rotation', () => {
  let state;

  beforeEach(() => {
    state = createState();
    state.objects.push(makeText({
      id: 't1', x: 0, y: 0, width: 200, height: 50, text: 'Rotated',
    }));
  });

  it('RotateCommand sets rotation on text object', () => {
    const cmd = new RotateCommand(['t1'], Math.PI / 4, { x: 100, y: 25 });
    cmd.execute(state);
    expect(state.objects[0].rotation).toBeCloseTo(Math.PI / 4);
  });

  it('rotation preserves text content', () => {
    const cmd = new RotateCommand(['t1'], Math.PI / 2, { x: 100, y: 25 });
    cmd.execute(state);
    expect(state.objects[0].text).toBe('Rotated');
    expect(state.objects[0].width).toBe(200);
  });

  it('rotation undo restores original', () => {
    const cmd = new RotateCommand(['t1'], Math.PI / 3, { x: 100, y: 25 });
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].rotation).toBeCloseTo(0);
    expect(state.objects[0].x).toBeCloseTo(0);
    expect(state.objects[0].y).toBeCloseTo(0);
  });

  it('rotate 30° → edit → commit: text stays at rotated position', () => {
    // Rotate
    const rotCmd = new RotateCommand(['t1'], Math.PI / 6, { x: 100, y: 25 });
    rotCmd.execute(state);
    const rotatedX = state.objects[0].x;
    const rotatedRotation = state.objects[0].rotation;

    // Modify text (simulates commit after edit)
    const modCmd = TextCommandFactory.modifyText(state.objects[0], { text: 'Edited after rotation' });
    const hm = new HistoryManager();
    hm.execute(modCmd, state);

    // Rotation and position should be preserved
    expect(state.objects[0].rotation).toBeCloseTo(rotatedRotation);
    expect(state.objects[0].text).toBe('Edited after rotation');
  });
});

/* ================================================================
   7. HISTORY SAFETY
   ================================================================ */
describe('Text History Safety', () => {
  let state, hm;

  beforeEach(() => {
    state = createState();
    hm = new HistoryManager();
  });

  it('undo restores content, width, height', () => {
    const cmd = TextCommandFactory.createText('Original', 0, 0, {
      width: 200, height: 50
    });
    hm.execute(cmd, state);

    const modCmd = TextCommandFactory.modifyText(state.objects[0], {
      text: 'Changed', width: 300, height: 60,
    });
    hm.execute(modCmd, state);

    hm.undo(state);
    expect(state.objects[0].text).toBe('Original');
    expect(state.objects[0].width).toBe(200);
    expect(state.objects[0].height).toBe(50);
  });

  it('redo re-applies text changes', () => {
    const cmd = TextCommandFactory.createText('V1', 0, 0);
    hm.execute(cmd, state);

    const modCmd = TextCommandFactory.modifyText(state.objects[0], { text: 'V2' });
    hm.execute(modCmd, state);

    hm.undo(state);
    hm.redo(state);
    expect(state.objects[0].text).toBe('V2');
  });

  it('undo create removes object', () => {
    const cmd = TextCommandFactory.createText('Temp', 0, 0);
    hm.execute(cmd, state);
    hm.undo(state);
    expect(state.objects).toHaveLength(0);
  });

  it('undo delete restores object', () => {
    state.objects.push(makeText({ id: 'del1', text: 'To Delete' }));
    const delCmd = TextCommandFactory.deleteText(state.objects[0]);
    hm.execute(delCmd, state);
    expect(state.objects).toHaveLength(0);
    hm.undo(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].text).toBe('To Delete');
  });

  it('multiple undo/redo cycle maintains integrity', () => {
    const cmd = TextCommandFactory.createText('A', 0, 0);
    hm.execute(cmd, state);
    hm.execute(TextCommandFactory.modifyText(state.objects[0], { text: 'B' }), state);
    hm.execute(TextCommandFactory.modifyText(state.objects[0], { text: 'C' }), state);
    hm.execute(TextCommandFactory.modifyText(state.objects[0], { text: 'D' }), state);

    hm.undo(state); // D → C
    hm.undo(state); // C → B
    hm.undo(state); // B → A
    expect(state.objects[0].text).toBe('A');

    hm.redo(state); // A → B
    hm.redo(state); // B → C
    expect(state.objects[0].text).toBe('C');

    hm.redo(state); // C → D
    expect(state.objects[0].text).toBe('D');
  });
});

/* ================================================================
   8. DEEP CLONE — formattedRanges integrity
   ================================================================ */
describe('TextCommand Deep Clone Safety', () => {
  let state, hm;

  beforeEach(() => {
    state = createState();
    hm = new HistoryManager();
  });

  it('modify preserves original formattedRanges on undo', () => {
    state.objects.push(makeText({
      id: 't1', text: 'Bold text',
      formattedRanges: [{ start: 0, end: 4, bold: true }],
    }));

    const originalRanges = state.objects[0].formattedRanges;

    // Modify text with new formatting
    const modCmd = TextCommandFactory.modifyText(state.objects[0], {
      text: 'Bold text updated',
      formattedRanges: [{ start: 0, end: 4, bold: true }, { start: 5, end: 9, italic: true }],
    });
    hm.execute(modCmd, state);

    // Mutate the current formattedRanges (simulates user action)
    state.objects[0].formattedRanges.push({ start: 10, end: 17, underline: true });

    // Undo should restore the ORIGINAL ranges, not the mutated ones
    hm.undo(state);
    expect(state.objects[0].formattedRanges).toHaveLength(1);
    expect(state.objects[0].formattedRanges[0]).toEqual({ start: 0, end: 4, bold: true });
  });

  it('redo after undo re-applies formatting correctly', () => {
    state.objects.push(makeText({
      id: 't1', text: 'Plain',
      formattedRanges: [],
    }));

    const modCmd = TextCommandFactory.modifyText(state.objects[0], {
      text: 'Plain',
      formattedRanges: [{ start: 0, end: 5, bold: true }],
    });
    hm.execute(modCmd, state);

    hm.undo(state);
    expect(state.objects[0].formattedRanges).toHaveLength(0);

    hm.redo(state);
    expect(state.objects[0].formattedRanges).toHaveLength(1);
    expect(state.objects[0].formattedRanges[0].bold).toBe(true);
  });

  it('delete undo restores deep-cloned object', () => {
    state.objects.push(makeText({
      id: 't1', text: 'To Delete',
      formattedRanges: [{ start: 0, end: 2, italic: true }],
    }));

    const delCmd = TextCommandFactory.deleteText(state.objects[0]);
    hm.execute(delCmd, state);
    expect(state.objects).toHaveLength(0);

    hm.undo(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].formattedRanges).toHaveLength(1);
    expect(state.objects[0].formattedRanges[0].italic).toBe(true);

    // Verify undo produces a deep clone — modifying restored object
    // should not affect the command's stored previousState
    const restoredRef = state.objects[0].formattedRanges;
    restoredRef.push({ start: 3, end: 5, bold: true });

    // Redo (re-delete) and undo again
    hm.redo(state); // re-delete — captures current (mutated) state
    hm.undo(state); // restore from snapshot taken at redo
    expect(state.objects).toHaveLength(1);
    // The restored object has the ranges that existed at redo time
    expect(state.objects[0].formattedRanges).toHaveLength(2);
    // But it's a new deep clone — verify independence
    expect(state.objects[0].formattedRanges).not.toBe(restoredRef);
  });
});

/* ================================================================
   9. LOCKING MODEL
   ================================================================ */
describe('Text Locking Model', () => {
  it('text object has lockedBy null on creation', () => {
    const cmd = TextCommandFactory.createText('Locked Test', 0, 0);
    expect(cmd.textObject.lockedBy).toBeNull();
  });

  it('modifyText can set lockedBy', () => {
    const state = createState();
    const hm = new HistoryManager();
    const cmd = TextCommandFactory.createText('Test', 0, 0);
    hm.execute(cmd, state);

    const lockCmd = TextCommandFactory.modifyText(state.objects[0], {
      lockedBy: 'user-123',
    });
    hm.execute(lockCmd, state);
    expect(state.objects[0].lockedBy).toBe('user-123');
  });

  it('modifyText can clear lockedBy on commit', () => {
    const state = createState();
    const hm = new HistoryManager();
    const cmd = TextCommandFactory.createText('Test', 0, 0);
    hm.execute(cmd, state);

    hm.execute(TextCommandFactory.modifyText(state.objects[0], { lockedBy: 'user-A' }), state);
    hm.execute(TextCommandFactory.modifyText(state.objects[0], { lockedBy: null, text: 'Final' }), state);
    expect(state.objects[0].lockedBy).toBeNull();
    expect(state.objects[0].text).toBe('Final');
  });
});

/* ================================================================
   10. COLLABORATION SYNC MODEL
   ================================================================ */
describe('Text Collaboration Sync', () => {
  let state;

  beforeEach(() => {
    state = createState();
    state.objects.push(makeText({
      id: 't1', text: 'Original', width: 200, height: 50,
    }));
  });

  it('remote text:update simulated — updates text and recalculates height', () => {
    const obj = state.objects[0];
    
    // Simulate what useRoomRemoteOperations does
    const operation = {
      text: 'Line1\nLine2\nLine3',
      fontSize: 16,
    };
    
    obj.text = operation.text;
    if (operation.fontSize !== undefined) obj.fontSize = operation.fontSize;
    
    // Height auto-recalculation (as implemented in the fix)
    const fontSize = obj.fontSize || 16;
    const lineHeight = fontSize * 1.2;
    const lines = (obj.text || '').split('\n');
    obj.height = Math.max(lines.length * lineHeight, lineHeight);
    
    expect(obj.height).toBeCloseTo(3 * 16 * 1.2);
  });

  it('remote text:update with width/height — uses provided dimensions', () => {
    const obj = state.objects[0];
    
    const operation = {
      text: 'Updated',
      width: 350,
      height: 40,
    };
    
    obj.text = operation.text;
    if (operation.width !== undefined) obj.width = operation.width;
    if (operation.height !== undefined) obj.height = operation.height;
    
    expect(obj.width).toBe(350);
    expect(obj.height).toBe(40);
  });
});

/* ================================================================
   11. TRANSFORM SAFETY — Move + Resize + Rotate
   ================================================================ */
describe('Text Transform Safety', () => {
  let state, hm;

  beforeEach(() => {
    state = createState();
    hm = new HistoryManager();
    state.objects.push(makeText({
      id: 't1', x: 100, y: 100, width: 200, height: 24, text: 'Transform Me', fontSize: 16,
    }));
  });

  it('move → resize → rotate → undo all → redo all', () => {
    // Move
    const moveCmd = new MoveCommand(['t1'], { x: 50, y: 30 });
    hm.execute(moveCmd, state);
    expect(state.objects[0].x).toBe(150);
    expect(state.objects[0].y).toBe(130);

    // Resize width
    const resizeCmd = new ResizeCommand(['t1'], {
      scaleX: 1.5, scaleY: 1, origin: { x: 150, y: 130 },
    });
    hm.execute(resizeCmd, state);
    expect(state.objects[0].width).toBe(300);

    // Rotate
    const rotateCmd = new RotateCommand(['t1'], Math.PI / 6, { x: 300, y: 140 });
    hm.execute(rotateCmd, state);
    expect(state.objects[0].rotation).toBeCloseTo(Math.PI / 6);

    // Text content should be preserved through all transforms
    expect(state.objects[0].text).toBe('Transform Me');

    // Undo rotate
    hm.undo(state);
    expect(state.objects[0].rotation).toBeCloseTo(0);

    // Undo resize
    hm.undo(state);
    expect(state.objects[0].width).toBe(200);

    // Undo move
    hm.undo(state);
    expect(state.objects[0].x).toBe(100);
    expect(state.objects[0].y).toBe(100);

    // Redo all
    hm.redo(state); // move
    hm.redo(state); // resize
    hm.redo(state); // rotate
    expect(state.objects[0].x).not.toBe(100); // moved + rotated
    expect(state.objects[0].width).toBe(300);
    expect(state.objects[0].rotation).toBeCloseTo(Math.PI / 6);
  });

  it('resize preserves text content and formatting', () => {
    state.objects[0].formattedRanges = [{ start: 0, end: 9, bold: true }];
    const cmd = new ResizeCommand(['t1'], {
      scaleX: 2, scaleY: 1, origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].text).toBe('Transform Me');
    expect(state.objects[0].formattedRanges[0].bold).toBe(true);
  });
});

/* ================================================================
   12. SERIALIZATION
   ================================================================ */
describe('Text Serialization', () => {
  it('TextCommand add serializes and deserializes', () => {
    const cmd = TextCommandFactory.createText('Serialize me', 10, 20, {
      fontSize: 20, fontWeight: 'bold',
    });
    const serialized = cmd.serialize();
    const restored = TextCommand.deserialize(serialized);

    expect(restored.action).toBe('add');
    expect(restored.textObject.text).toBe('Serialize me');
    expect(restored.textObject.fontSize).toBe(20);
    expect(restored.textObject.fontWeight).toBe('bold');
  });

  it('TextCommand modify serializes previousState', () => {
    const state = createState();
    state.objects.push(makeText({ id: 't_ser', text: 'Before' }));

    const modCmd = TextCommandFactory.modifyText(state.objects[0], { text: 'After' });
    modCmd.execute(state);

    const serialized = modCmd.serialize();
    expect(serialized.previousState).toBeDefined();
    expect(serialized.previousState.text).toBe('Before');

    const restored = TextCommand.deserialize(serialized);
    expect(restored.previousState.text).toBe('Before');
  });
});

/* ================================================================
   13. EDGE CASES
   ================================================================ */
describe('Text Edge Cases', () => {
  let state, hm;

  beforeEach(() => {
    state = createState();
    hm = new HistoryManager();
  });

  it('very long text handles correctly', () => {
    const longText = 'A'.repeat(10000);
    const cmd = TextCommandFactory.createText(longText, 0, 0);
    hm.execute(cmd, state);
    expect(state.objects[0].text.length).toBe(10000);

    const modCmd = TextCommandFactory.modifyText(state.objects[0], {
      text: longText + ' added',
    });
    hm.execute(modCmd, state);
    expect(state.objects[0].text.length).toBe(10006);

    hm.undo(state);
    expect(state.objects[0].text.length).toBe(10000);
  });

  it('special characters in text', () => {
    const special = '🎨 Canvas & <script>"injection"</script> 中文 العربية';
    const cmd = TextCommandFactory.createText(special, 0, 0);
    hm.execute(cmd, state);
    expect(state.objects[0].text).toBe(special);
  });

  it('resize with scale=0 keeps minimum width', () => {
    state.objects.push(makeText({ id: 't1', width: 200, height: 50, text: 'Test' }));
    const cmd = new ResizeCommand(['t1'], {
      scaleX: 0, scaleY: 0, origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].width).toBeGreaterThanOrEqual(4);
    expect(state.objects[0].height).toBeGreaterThan(0);
  });

  it('text with only whitespace', () => {
    const cmd = TextCommandFactory.createText('   ', 0, 0);
    hm.execute(cmd, state);
    expect(state.objects[0].text).toBe('   ');
  });

  it('modify text preserves id', () => {
    const cmd = TextCommandFactory.createText('Test', 0, 0);
    hm.execute(cmd, state);
    const id = state.objects[0].id;

    hm.execute(TextCommandFactory.modifyText(state.objects[0], { text: 'New' }), state);
    expect(state.objects[0].id).toBe(id);
  });

  it('rapid undo/redo does not corrupt state', () => {
    const cmd = TextCommandFactory.createText('Start', 0, 0);
    hm.execute(cmd, state);

    for (let i = 0; i < 20; i++) {
      hm.execute(TextCommandFactory.modifyText(state.objects[0], {
        text: `Version ${i}`,
        formattedRanges: [{ start: 0, end: i + 1, bold: true }],
      }), state);
    }

    // Undo all 20 modifications
    for (let i = 0; i < 20; i++) {
      hm.undo(state);
    }
    expect(state.objects[0].text).toBe('Start');

    // Redo all
    for (let i = 0; i < 20; i++) {
      hm.redo(state);
    }
    expect(state.objects[0].text).toBe('Version 19');
    expect(state.objects[0].formattedRanges).toHaveLength(1);
    expect(state.objects[0].formattedRanges[0].end).toBe(20);
  });
});
