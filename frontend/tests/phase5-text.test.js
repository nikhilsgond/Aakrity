/**
 * Phase 5 — Text-Specific Tests
 *
 * Enter edit mode
 * Commit changes
 * Re-edit
 * Resize reflows text
 * Toolbar shows only when selected (tested via state flags)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createState, makeText } from './helpers.js';

import { HistoryManager } from '../src/features/canvas/engine/history/HistoryManager.js';
import { TextCommand, TextCommandFactory } from '../src/features/canvas/engine/commands/TextCommands.js';
import { ResizeCommand } from '../src/features/canvas/engine/commands/ResizeCommand.js';
import { MoveCommand } from '../src/features/canvas/engine/commands/MoveCommand.js';
import { SelectObjectsCommand, ClearSelectionCommand } from '../src/features/canvas/engine/commands/SelectionCommands.js';

/* ================================================================
   TextCommandFactory
   ================================================================ */
describe('Phase 5 — TextCommandFactory', () => {
  it('createText returns a TextCommand with correct defaults', () => {
    const cmd = TextCommandFactory.createText('Hello', 50, 100);
    expect(cmd).toBeInstanceOf(TextCommand);
    expect(cmd.action).toBe('add');
    expect(cmd.textObject.text).toBe('Hello');
    expect(cmd.textObject.x).toBe(50);
    expect(cmd.textObject.y).toBe(100);
    expect(cmd.textObject.fontFamily).toBe('Arial, sans-serif');
    expect(cmd.textObject.fontSize).toBe(16);
    expect(cmd.textObject.isEditing).toBe(false);
  });

  it('createText with custom options', () => {
    const cmd = TextCommandFactory.createText('Test', 0, 0, {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#ff0000',
      textAlign: 'center',
    });
    expect(cmd.textObject.fontSize).toBe(24);
    expect(cmd.textObject.fontWeight).toBe('bold');
    expect(cmd.textObject.textColor).toBe('#ff0000');
    expect(cmd.textObject.textAlign).toBe('center');
  });

  it('createText generates unique IDs', () => {
    const cmd1 = TextCommandFactory.createText('A', 0, 0);
    const cmd2 = TextCommandFactory.createText('B', 0, 0);
    expect(cmd1.textObject.id).not.toBe(cmd2.textObject.id);
  });

  it('createText with empty text uses empty string', () => {
    const cmd = TextCommandFactory.createText('', 0, 0);
    expect(cmd.textObject.text).toBe('');
  });

  it('modifyText creates a modify command', () => {
    const original = makeText({ id: 'txt_1' });
    const cmd = TextCommandFactory.modifyText(original, { text: 'Updated', fontSize: 20 });
    expect(cmd.action).toBe('modify');
    expect(cmd.textObject.text).toBe('Updated');
    expect(cmd.textObject.fontSize).toBe(20);
    expect(cmd.textObject.updatedAt).toBeGreaterThan(0);
  });

  it('deleteText creates a delete command', () => {
    const original = makeText({ id: 'txt_1' });
    const cmd = TextCommandFactory.deleteText(original);
    expect(cmd.action).toBe('delete');
    expect(cmd.textObject.id).toBe('txt_1');
  });
});

/* ================================================================
   Enter Edit Mode / Commit / Re-edit
   ================================================================ */
describe('Phase 5 — Text Edit Lifecycle', () => {
  let state, hm;

  beforeEach(() => {
    state = createState();
    hm = new HistoryManager();
  });

  it('create text, enter edit mode (isEditing flag)', () => {
    const cmd = TextCommandFactory.createText('Hello', 50, 50);
    hm.execute(cmd, state);
    expect(state.objects[0].isEditing).toBe(false);

    // Simulate entering edit mode
    const editCmd = TextCommandFactory.modifyText(state.objects[0], { isEditing: true });
    hm.execute(editCmd, state);
    expect(state.objects[0].isEditing).toBe(true);
  });

  it('commit changes (isEditing = false, text updated)', () => {
    const cmd = TextCommandFactory.createText('Draft', 50, 50);
    hm.execute(cmd, state);
    const id = state.objects[0].id;

    // Enter edit mode
    const editCmd = TextCommandFactory.modifyText(state.objects[0], { isEditing: true });
    hm.execute(editCmd, state);

    // Commit new text
    const commitCmd = TextCommandFactory.modifyText(state.objects[0], {
      text: 'Final version',
      isEditing: false,
    });
    hm.execute(commitCmd, state);

    expect(state.objects[0].text).toBe('Final version');
    expect(state.objects[0].isEditing).toBe(false);
  });

  it('re-edit after commit', () => {
    const cmd = TextCommandFactory.createText('First', 50, 50);
    hm.execute(cmd, state);

    // First edit cycle
    hm.execute(TextCommandFactory.modifyText(state.objects[0], { isEditing: true }), state);
    hm.execute(TextCommandFactory.modifyText(state.objects[0], { text: 'Second', isEditing: false }), state);

    // Second edit cycle
    hm.execute(TextCommandFactory.modifyText(state.objects[0], { isEditing: true }), state);
    hm.execute(TextCommandFactory.modifyText(state.objects[0], { text: 'Third', isEditing: false }), state);

    expect(state.objects[0].text).toBe('Third');
  });

  it('undo after text edit restores previous text', () => {
    const cmd = TextCommandFactory.createText('Original', 50, 50);
    hm.execute(cmd, state);

    const modCmd = TextCommandFactory.modifyText(state.objects[0], { text: 'Changed' });
    hm.execute(modCmd, state);
    expect(state.objects[0].text).toBe('Changed');

    hm.undo(state);
    expect(state.objects[0].text).toBe('Original');
  });
});

/* ================================================================
   Resize Reflows Text
   ================================================================ */
describe('Phase 5 — Text Resize', () => {
  let state;

  beforeEach(() => {
    state = createState();
    state.objects.push(makeText({
      id: 'txt_1',
      x: 0,
      y: 0,
      width: 200,
      height: 50,
      fontSize: 16,
    }));
  });

  it('resize changes text width', () => {
    const cmd = new ResizeCommand(['txt_1'], {
      scaleX: 1.5,
      scaleY: 1,
      origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].width).toBeGreaterThan(200);
  });

  it('resize with isTextFontResize scales fontSize', () => {
    const cmd = new ResizeCommand(['txt_1'], {
      scaleX: 2,
      scaleY: 2,
      origin: { x: 0, y: 0 },
      isTextFontResize: true,
    });
    cmd.execute(state);
    expect(state.objects[0].fontSize).toBe(32);
  });

  it('font size respects min (8) and max (500) limits', () => {
    // Scale down to very small
    const cmdDown = new ResizeCommand(['txt_1'], {
      scaleX: 0.1,
      scaleY: 0.1,
      origin: { x: 0, y: 0 },
      isTextFontResize: true,
    });
    cmdDown.execute(state);
    expect(state.objects[0].fontSize).toBeGreaterThanOrEqual(8);
  });

  it('resize preserves text content', () => {
    const cmd = new ResizeCommand(['txt_1'], {
      scaleX: 2,
      scaleY: 2,
      origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    expect(state.objects[0].text).toBe('Hello World');
  });

  it('resize undo restores original dimensions', () => {
    const originalWidth = state.objects[0].width;
    const originalHeight = state.objects[0].height;

    const cmd = new ResizeCommand(['txt_1'], {
      scaleX: 2,
      scaleY: 2,
      origin: { x: 0, y: 0 },
    });
    cmd.execute(state);
    cmd.undo(state);

    expect(state.objects[0].width).toBe(originalWidth);
    expect(state.objects[0].height).toBe(originalHeight);
  });
});

/* ================================================================
   Text Selection State (toolbar visibility proxy)
   ================================================================ */
describe('Phase 5 — Text Selection State', () => {
  let state;

  beforeEach(() => {
    state = createState();
    state.objects.push(makeText({ id: 'txt_1' }));
    state.objects.push(makeText({ id: 'txt_2', x: 300, y: 300, text: 'Other text' }));
  });

  it('selecting text sets selection state', () => {
    const cmd = new SelectObjectsCommand(['txt_1']);
    cmd.execute(state);
    expect(state.selection).toEqual(['txt_1']);
  });

  it('deselecting text clears selection', () => {
    state.selection = ['txt_1'];
    const cmd = new ClearSelectionCommand();
    cmd.execute(state);
    expect(state.selection).toEqual([]);
  });

  it('selecting text does not affect other text objects', () => {
    const cmd = new SelectObjectsCommand(['txt_1']);
    cmd.execute(state);
    // txt_2 should not be in selection
    expect(state.selection).not.toContain('txt_2');
    expect(state.objects[1].isEditing).toBe(false);
  });

  it('multiple text selection works', () => {
    const cmd = new SelectObjectsCommand(['txt_1', 'txt_2']);
    cmd.execute(state);
    expect(state.selection).toEqual(['txt_1', 'txt_2']);
  });
});

/* ================================================================
   Text Move  
   ================================================================ */
describe('Phase 5 — Text Move', () => {
  let state;

  beforeEach(() => {
    state = createState();
    state.objects.push(makeText({ id: 'txt_1', x: 50, y: 50 }));
  });

  it('moving text updates position', () => {
    const cmd = new MoveCommand(['txt_1'], { x: 100, y: 50 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(150);
    expect(state.objects[0].y).toBe(100);
  });

  it('moving text preserves text content and formatting', () => {
    const cmd = new MoveCommand(['txt_1'], { x: 100, y: 50 });
    cmd.execute(state);
    expect(state.objects[0].text).toBe('Hello World');
    expect(state.objects[0].fontSize).toBe(16);
    expect(state.objects[0].fontFamily).toBe('Arial, sans-serif');
  });

  it('move undo restores text position', () => {
    const cmd = new MoveCommand(['txt_1'], { x: 100, y: 50 });
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].x).toBe(50);
    expect(state.objects[0].y).toBe(50);
  });
});

/* ================================================================
   Text Width/Height Auto-Calculation
   ================================================================ */
describe('Phase 5 — Text Auto-Height', () => {
  it('text object has width and height properties', () => {
    const cmd = TextCommandFactory.createText('Hello', 0, 0);
    expect(cmd.textObject.width).toBe(200);
    expect(cmd.textObject.height).toBe(50);
  });

  it('text factory allows custom width', () => {
    const cmd = TextCommandFactory.createText('Hello', 0, 0, { width: 400 });
    expect(cmd.textObject.width).toBe(400);
  });

  it('text factory allows custom height', () => {
    const cmd = TextCommandFactory.createText('Hello', 0, 0, { height: 100 });
    expect(cmd.textObject.height).toBe(100);
  });
});

/* ================================================================
   Text Serialization
   ================================================================ */
describe('Phase 5 — Text Serialization', () => {
  it('TextCommand serializes correctly', () => {
    const textObj = makeText({ id: 'txt_serial' });
    const cmd = new TextCommand(textObj, 'add');
    const serialized = cmd.serialize();
    expect(serialized.textObject.id).toBe('txt_serial');
    expect(serialized.action).toBe('add');
  });

  it('TextCommand deserializes correctly', () => {
    const textObj = makeText({ id: 'txt_serial' });
    const cmd = new TextCommand(textObj, 'modify');
    const serialized = cmd.serialize();
    const deserialized = TextCommand.deserialize(serialized);
    expect(deserialized.action).toBe('modify');
    expect(deserialized.textObject.id).toBe('txt_serial');
  });
});
