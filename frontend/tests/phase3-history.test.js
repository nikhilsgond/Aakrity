/**
 * Phase 3 — History (Undo / Redo) Tests
 *
 * For every command: execute(), undo(), redo()
 * Multiple undo stack
 * Undo after remote operation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createState, makeRect, makeCircle, makeLine, makeText, makeDrawing } from './helpers.js';

import { HistoryManager } from '../src/features/canvas/engine/history/HistoryManager.js';
import { AddShapeCommand } from '../src/features/canvas/engine/commands/ShapeCommands.js';
import { MoveCommand } from '../src/features/canvas/engine/commands/MoveCommand.js';
import { ResizeCommand } from '../src/features/canvas/engine/commands/ResizeCommand.js';
import { RotateCommand } from '../src/features/canvas/engine/commands/RotateCommand.js';
import { SelectObjectsCommand, ClearSelectionCommand } from '../src/features/canvas/engine/commands/SelectionCommands.js';
import { TextCommand } from '../src/features/canvas/engine/commands/TextCommands.js';
import { PencilCommand } from '../src/features/canvas/engine/commands/PencilCommands.js';
import { PanViewportCommand, ZoomViewportCommand, ClearCanvasCommand, ResetViewportCommand } from '../src/features/canvas/engine/commands/ViewportCommands.js';
import { ApplyEraserCommand } from '../src/features/canvas/engine/commands/EraserCommands.js';

/* ================================================================
   History Manager Core
   ================================================================ */
describe('Phase 3 — HistoryManager Core', () => {
  let hm;
  let state;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
  });

  it('starts with empty stacks', () => {
    expect(hm.canUndo()).toBe(false);
    expect(hm.canRedo()).toBe(false);
  });

  it('execute pushes to undo stack', () => {
    const cmd = new AddShapeCommand(makeRect());
    hm.execute(cmd, state);
    expect(hm.canUndo()).toBe(true);
    expect(hm.canRedo()).toBe(false);
  });

  it('undo pops from undo and pushes to redo', () => {
    const cmd = new AddShapeCommand(makeRect());
    hm.execute(cmd, state);
    hm.undo(state);
    expect(hm.canUndo()).toBe(false);
    expect(hm.canRedo()).toBe(true);
  });

  it('redo pops from redo and pushes to undo', () => {
    const cmd = new AddShapeCommand(makeRect());
    hm.execute(cmd, state);
    hm.undo(state);
    hm.redo(state);
    expect(hm.canUndo()).toBe(true);
    expect(hm.canRedo()).toBe(false);
  });

  it('new command after undo clears redo stack', () => {
    const cmd1 = new AddShapeCommand(makeRect({ id: 'r1' }));
    const cmd2 = new AddShapeCommand(makeCircle({ id: 'c1' }));
    hm.execute(cmd1, state);
    hm.undo(state);
    hm.execute(cmd2, state);
    expect(hm.canRedo()).toBe(false);
  });

  it('undo with empty stack returns null', () => {
    const result = hm.undo(state);
    expect(result).toBeNull();
  });

  it('redo with empty stack returns null', () => {
    const result = hm.redo(state);
    expect(result).toBeNull();
  });

  it('maxStackSize limits undo stack', () => {
    hm.maxStackSize = 5;
    for (let i = 0; i < 10; i++) {
      hm.execute(new AddShapeCommand(makeRect({ id: `r_${i}` })), state);
    }
    expect(hm.undoStack.length).toBeLessThanOrEqual(5);
  });

  it('clear empties both stacks', () => {
    hm.execute(new AddShapeCommand(makeRect()), state);
    hm.undo(state);
    hm.clear();
    expect(hm.canUndo()).toBe(false);
    expect(hm.canRedo()).toBe(false);
  });

  it('getHistoryInfo returns correct counts', () => {
    hm.execute(new AddShapeCommand(makeRect({ id: 'r1' })), state);
    hm.execute(new AddShapeCommand(makeCircle({ id: 'c1' })), state);
    hm.undo(state);
    const info = hm.getHistoryInfo();
    expect(info.undoCount).toBe(1);
    expect(info.redoCount).toBe(1);
    expect(info.canUndo).toBe(true);
    expect(info.canRedo).toBe(true);
  });

  it('registerWithoutExecuting adds to undo stack without executing', () => {
    const cmd = new AddShapeCommand(makeRect());
    hm.registerWithoutExecuting(cmd);
    expect(hm.canUndo()).toBe(true);
    // Object should NOT be in state since we didn't execute
    expect(state.objects).toHaveLength(0);
  });
});

/* ================================================================
   Execute / Undo / Redo per Command Type
   ================================================================ */
describe('Phase 3 — AddShapeCommand undo/redo', () => {
  let hm, state;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
  });

  it('execute → undo → redo cycle', () => {
    const cmd = new AddShapeCommand(makeRect({ id: 'shape_test' }));
    hm.execute(cmd, state);
    expect(state.objects).toHaveLength(1);

    hm.undo(state);
    expect(state.objects).toHaveLength(0);

    hm.redo(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].id).toBe('shape_test');
  });
});

describe('Phase 3 — MoveCommand undo/redo', () => {
  let hm, state;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
    state.objects.push(makeRect({ id: 'r1', x: 100, y: 100 }));
  });

  it('execute → undo → redo cycle', () => {
    const cmd = new MoveCommand(['r1'], { x: 50, y: 50 });
    hm.execute(cmd, state);
    expect(state.objects[0].x).toBe(150);

    hm.undo(state);
    expect(state.objects[0].x).toBe(100);

    hm.redo(state);
    expect(state.objects[0].x).toBe(150);
  });
});

describe('Phase 3 — ResizeCommand undo/redo', () => {
  let hm, state;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
    state.objects.push(makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100 }));
  });

  it('execute → undo → redo cycle', () => {
    const cmd = new ResizeCommand(['r1'], {
      scaleX: 2,
      scaleY: 2,
      origin: { x: 0, y: 0 },
    });
    hm.execute(cmd, state);
    expect(state.objects[0].width).toBe(200);

    hm.undo(state);
    expect(state.objects[0].width).toBe(100);

    hm.redo(state);
    expect(state.objects[0].width).toBe(200);
  });
});

describe('Phase 3 — RotateCommand undo/redo', () => {
  let hm, state;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
    state.objects.push(makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100, rotation: 0 }));
  });

  it('execute → undo → redo cycle', () => {
    const center = { x: 50, y: 50 };
    const cmd = new RotateCommand(['r1'], Math.PI / 4, center);
    hm.execute(cmd, state);
    expect(state.objects[0].rotation).toBeCloseTo(Math.PI / 4);

    hm.undo(state);
    expect(state.objects[0].rotation).toBeCloseTo(0);

    hm.redo(state);
    expect(state.objects[0].rotation).toBeCloseTo(Math.PI / 4);
  });
});

describe('Phase 3 — SelectionCommand undo/redo', () => {
  let hm, state;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
    state.objects.push(makeRect({ id: 'r1' }));
    state.objects.push(makeCircle({ id: 'c1' }));
  });

  it('SelectObjectsCommand cycle', () => {
    const cmd = new SelectObjectsCommand(['r1', 'c1']);
    hm.execute(cmd, state);
    expect(state.selection).toEqual(['r1', 'c1']);

    hm.undo(state);
    expect(state.selection).toEqual([]);

    hm.redo(state);
    expect(state.selection).toEqual(['r1', 'c1']);
  });

  it('ClearSelectionCommand cycle', () => {
    state.selection = ['r1'];
    const cmd = new ClearSelectionCommand();
    hm.execute(cmd, state);
    expect(state.selection).toEqual([]);

    hm.undo(state);
    expect(state.selection).toEqual(['r1']);

    hm.redo(state);
    expect(state.selection).toEqual([]);
  });
});

describe('Phase 3 — TextCommand undo/redo', () => {
  let hm, state;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
  });

  it('add cycle', () => {
    const textObj = makeText({ id: 'txt_1' });
    const cmd = new TextCommand(textObj, 'add');
    hm.execute(cmd, state);
    expect(state.objects).toHaveLength(1);

    hm.undo(state);
    expect(state.objects).toHaveLength(0);

    hm.redo(state);
    expect(state.objects).toHaveLength(1);
  });

  it('modify cycle', () => {
    state.objects.push(makeText({ id: 'txt_1' }));
    const modified = { ...makeText({ id: 'txt_1' }), text: 'Modified' };
    const cmd = new TextCommand(modified, 'modify');
    hm.execute(cmd, state);
    expect(state.objects[0].text).toBe('Modified');

    hm.undo(state);
    expect(state.objects[0].text).toBe('Hello World');

    hm.redo(state);
    expect(state.objects[0].text).toBe('Modified');
  });

  it('delete cycle', () => {
    state.objects.push(makeText({ id: 'txt_1' }));
    const cmd = new TextCommand(makeText({ id: 'txt_1' }), 'delete');
    hm.execute(cmd, state);
    expect(state.objects).toHaveLength(0);

    hm.undo(state);
    expect(state.objects).toHaveLength(1);

    hm.redo(state);
    expect(state.objects).toHaveLength(0);
  });
});

describe('Phase 3 — PencilCommand undo/redo', () => {
  let hm, state;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
  });

  it('execute → undo → redo cycle', () => {
    const cmd = new PencilCommand(
      [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      { id: 'pencil_test' }
    );
    hm.execute(cmd, state);
    expect(state.objects).toHaveLength(1);

    hm.undo(state);
    expect(state.objects).toHaveLength(0);

    hm.redo(state);
    expect(state.objects).toHaveLength(1);
  });
});

describe('Phase 3 — ViewportCommands undo/redo', () => {
  let hm, state;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
  });

  it('PanViewportCommand cycle', () => {
    const cmd = new PanViewportCommand(100, 50);
    hm.execute(cmd, state);
    expect(state.viewport.panX).toBe(100);
    expect(state.viewport.panY).toBe(50);

    hm.undo(state);
    expect(state.viewport.panX).toBe(0);
    expect(state.viewport.panY).toBe(0);

    hm.redo(state);
    expect(state.viewport.panX).toBe(100);
    expect(state.viewport.panY).toBe(50);
  });

  it('ZoomViewportCommand cycle', () => {
    const cmd = new ZoomViewportCommand(2, 400, 300);
    hm.execute(cmd, state);
    expect(state.viewport.zoom).toBe(2);

    hm.undo(state);
    expect(state.viewport.zoom).toBe(1);

    hm.redo(state);
    expect(state.viewport.zoom).toBe(2);
  });

  it('ClearCanvasCommand cycle', () => {
    state.objects.push(makeRect({ id: 'r1' }));
    state.objects.push(makeCircle({ id: 'c1' }));
    state.selection = ['r1'];

    const cmd = new ClearCanvasCommand();
    hm.execute(cmd, state);
    expect(state.objects).toHaveLength(0);
    expect(state.selection).toHaveLength(0);

    hm.undo(state);
    expect(state.objects).toHaveLength(2);
    expect(state.selection).toEqual(['r1']);
  });

  it('ResetViewportCommand cycle', () => {
    state.viewport = { zoom: 2.5, panX: 100, panY: 200 };
    const cmd = new ResetViewportCommand();
    hm.execute(cmd, state);
    expect(state.viewport.zoom).toBe(1);
    expect(state.viewport.panX).toBe(0);

    hm.undo(state);
    expect(state.viewport.zoom).toBe(2.5);
    expect(state.viewport.panX).toBe(100);
  });
});

describe('Phase 3 — EraserCommand undo/redo', () => {
  let hm, state;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
  });

  it('eraser removes object and undo restores', () => {
    const rect = makeRect({ id: 'r1' });
    state.objects.push({ ...rect });

    const cmd = new ApplyEraserCommand({
      beforeObjects: [rect],
      afterObjects: [],
      addedObjects: [],
    });
    hm.execute(cmd, state);
    expect(state.objects).toHaveLength(0);

    hm.undo(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].id).toBe('r1');
  });
});

/* ================================================================
   Multiple Undo Stack
   ================================================================ */
describe('Phase 3 — Multiple Undo sequence', () => {
  let hm, state;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
  });

  it('undo 3 commands in reverse order', () => {
    const cmd1 = new AddShapeCommand(makeRect({ id: 'r1' }));
    const cmd2 = new AddShapeCommand(makeCircle({ id: 'c1' }));
    const cmd3 = new MoveCommand(['r1'], { x: 50, y: 50 });

    hm.execute(cmd1, state);
    hm.execute(cmd2, state);
    hm.execute(cmd3, state);
    expect(state.objects).toHaveLength(2);

    // Undo move
    hm.undo(state);
    expect(state.objects[0].x).toBe(100); // original rect x

    // Undo circle add
    hm.undo(state);
    expect(state.objects).toHaveLength(1);

    // Undo rect add
    hm.undo(state);
    expect(state.objects).toHaveLength(0);
  });

  it('interleaved undo/redo maintains consistent state', () => {
    hm.execute(new AddShapeCommand(makeRect({ id: 'r1' })), state);
    hm.execute(new AddShapeCommand(makeCircle({ id: 'c1' })), state);

    hm.undo(state); // undo circle
    expect(state.objects).toHaveLength(1);

    hm.redo(state); // redo circle
    expect(state.objects).toHaveLength(2);

    hm.undo(state); // undo circle again
    hm.undo(state); // undo rect
    expect(state.objects).toHaveLength(0);

    hm.redo(state); // redo rect
    hm.redo(state); // redo circle
    expect(state.objects).toHaveLength(2);
  });
});

/* ================================================================
   Batch Commands
   ================================================================ */
describe('Phase 3 — Batch Commands', () => {
  let hm, state;

  beforeEach(() => {
    hm = new HistoryManager();
    state = createState();
  });

  it('executeBatch executes all commands and single undo reverts all', () => {
    const cmds = [
      new AddShapeCommand(makeRect({ id: 'r1' })),
      new AddShapeCommand(makeCircle({ id: 'c1' })),
    ];
    hm.executeBatch(cmds, state);
    expect(state.objects).toHaveLength(2);

    // Single undo should revert the entire batch
    hm.undo(state);
    expect(state.objects).toHaveLength(0);
  });
});

/* ================================================================
   Serialization
   ================================================================ */
describe('Phase 3 — Command Serialization', () => {
  it('AddShapeCommand serializes and deserializes', () => {
    const rect = makeRect({ id: 'serial_r1' });
    const cmd = new AddShapeCommand(rect);
    const serialized = cmd.serialize();
    expect(serialized.type).toBe('AddShapeCommand');
    expect(serialized.objectId).toBe('serial_r1');

    const deserialized = AddShapeCommand.deserialize(serialized);
    expect(deserialized.objectId).toBe('serial_r1');
  });

  it('MoveCommand serializes and deserializes', () => {
    const state = createState();
    state.objects.push(makeRect({ id: 'r1', x: 50, y: 50 }));
    const cmd = new MoveCommand(['r1'], { x: 10, y: 20 });
    cmd.execute(state); // populate initialPositions
    const serialized = cmd.serialize();

    const deserialized = MoveCommand.deserialize(serialized);
    expect(deserialized.objectIds).toEqual(['r1']);
    expect(deserialized.delta).toEqual({ x: 10, y: 20 });
  });

  it('RotateCommand serializes and deserializes', () => {
    const cmd = new RotateCommand(['r1'], Math.PI / 4, { x: 50, y: 50 });
    const serialized = cmd.serialize();
    const deserialized = RotateCommand.deserialize(serialized);
    expect(deserialized.angle).toBeCloseTo(Math.PI / 4);
    expect(deserialized.origin).toEqual({ x: 50, y: 50 });
  });

  it('PencilCommand serializes and deserializes', () => {
    const cmd = new PencilCommand(
      [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      { strokeColor: '#ff0000', strokeWidth: 3, opacity: 0.8, id: 'pencil_serial' }
    );
    const serialized = cmd.serialize();
    const deserialized = PencilCommand.deserialize(serialized);
    expect(deserialized.objectId).toBe('pencil_serial');
    expect(deserialized.points).toHaveLength(2);
  });
});
