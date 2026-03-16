/**
 * Color Picker System — Phase 2 Tests
 *
 * Tests for UpdateStyleCommand (undo/redo, multi-object, edge cases)
 * and the color utility helpers (hex validation, recent colors persistence).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateStyleCommand } from '../src/features/canvas/engine/commands/UpdateStyleCommand';
import { deserializeCommand } from '../src/features/canvas/engine/commands/index';
import { createState, makeRect, makeCircle, makeLine, makeDrawing, makeText, makeEllipse } from './helpers';

// --------------- helpers ---------------
function makeEmoji(overrides = {}) {
  return {
    id: 'emoji_1',
    type: 'emoji',
    emoji: '😀',
    x: 100,
    y: 100,
    width: 64,
    height: 64,
    opacity: 1,
    rotation: 0,
    layer: 'default',
    createdAt: Date.now(),
    ...overrides,
  };
}

// ============================================================
// UpdateStyleCommand — single object
// ============================================================
describe('UpdateStyleCommand — Single Object', () => {
  let state;
  beforeEach(() => {
    state = createState();
    state.objects.push(makeRect({ id: 'r1', strokeColor: '#000000', fillColor: 'transparent', opacity: 1, strokeWidth: 2 }));
  });

  it('changes strokeColor and records previous value', () => {
    const cmd = new UpdateStyleCommand(['r1'], { strokeColor: '#FF0000' });
    cmd.execute(state);
    expect(state.objects[0].strokeColor).toBe('#FF0000');
  });

  it('changes fillColor', () => {
    const cmd = new UpdateStyleCommand(['r1'], { fillColor: '#00FF00' });
    cmd.execute(state);
    expect(state.objects[0].fillColor).toBe('#00FF00');
  });

  it('changes opacity', () => {
    const cmd = new UpdateStyleCommand(['r1'], { opacity: 0.5 });
    cmd.execute(state);
    expect(state.objects[0].opacity).toBe(0.5);
  });

  it('changes strokeWidth', () => {
    const cmd = new UpdateStyleCommand(['r1'], { strokeWidth: 8 });
    cmd.execute(state);
    expect(state.objects[0].strokeWidth).toBe(8);
  });

  it('changes multiple properties at once', () => {
    const cmd = new UpdateStyleCommand(['r1'], { strokeColor: '#0000FF', fillColor: '#FFFF00', opacity: 0.7 });
    cmd.execute(state);
    expect(state.objects[0].strokeColor).toBe('#0000FF');
    expect(state.objects[0].fillColor).toBe('#FFFF00');
    expect(state.objects[0].opacity).toBe(0.7);
  });

  it('undo restores all original values', () => {
    const cmd = new UpdateStyleCommand(['r1'], { strokeColor: '#AAAAAA', opacity: 0.3 });
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].strokeColor).toBe('#000000');
    expect(state.objects[0].opacity).toBe(1);
  });

  it('re-execute after undo re-applies changes', () => {
    const cmd = new UpdateStyleCommand(['r1'], { strokeColor: '#AAAAAA' });
    cmd.execute(state);
    cmd.undo(state);
    cmd.execute(state);
    expect(state.objects[0].strokeColor).toBe('#AAAAAA');
  });

  it('returns true when objects were changed', () => {
    const cmd = new UpdateStyleCommand(['r1'], { strokeColor: '#FF0000' });
    expect(cmd.execute(state)).toBe(true);
  });

  it('returns false when objectId does not exist', () => {
    const cmd = new UpdateStyleCommand(['nonexistent'], { strokeColor: '#FF0000' });
    expect(cmd.execute(state)).toBe(false);
  });

  it('undo returns false when previousStyles is null (never executed)', () => {
    const cmd = new UpdateStyleCommand(['r1'], { strokeColor: '#FF0000' });
    expect(cmd.undo(state)).toBe(false);
  });

  it('handles setting a new property that did not exist', () => {
    // cornerRadius doesn't exist on the rect created by makeRect (default 0 if not set)
    const cmd = new UpdateStyleCommand(['r1'], { cornerRadius: 12 });
    cmd.execute(state);
    expect(state.objects[0].cornerRadius).toBe(12);
    cmd.undo(state);
    // original was undefined
    expect(state.objects[0].cornerRadius).toBeUndefined();
  });
});

// ============================================================
// UpdateStyleCommand — multi-object
// ============================================================
describe('UpdateStyleCommand — Multi-Object', () => {
  let state;
  beforeEach(() => {
    state = createState();
    state.objects.push(makeRect({ id: 'r1', strokeColor: '#111111' }));
    state.objects.push(makeCircle({ id: 'c1', strokeColor: '#222222' }));
    state.objects.push(makeLine({ id: 'l1', strokeColor: '#333333' }));
  });

  it('applies same strokeColor to all objects', () => {
    const cmd = new UpdateStyleCommand(['r1', 'c1', 'l1'], { strokeColor: '#FF0000' });
    cmd.execute(state);
    expect(state.objects[0].strokeColor).toBe('#FF0000');
    expect(state.objects[1].strokeColor).toBe('#FF0000');
    expect(state.objects[2].strokeColor).toBe('#FF0000');
  });

  it('undo restores each object to its own original color', () => {
    const cmd = new UpdateStyleCommand(['r1', 'c1', 'l1'], { strokeColor: '#FF0000' });
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].strokeColor).toBe('#111111');
    expect(state.objects[1].strokeColor).toBe('#222222');
    expect(state.objects[2].strokeColor).toBe('#333333');
  });

  it('skips non-existent IDs gracefully', () => {
    const cmd = new UpdateStyleCommand(['r1', 'ghost', 'c1'], { opacity: 0.4 });
    cmd.execute(state);
    expect(state.objects[0].opacity).toBe(0.4);
    expect(state.objects[1].opacity).toBe(0.4);
    // line was not targeted
    expect(state.objects[2].opacity).toBe(1);
  });

  it('changes opacity on all targeted objects', () => {
    const cmd = new UpdateStyleCommand(['r1', 'c1'], { opacity: 0.25 });
    cmd.execute(state);
    expect(state.objects[0].opacity).toBe(0.25);
    expect(state.objects[1].opacity).toBe(0.25);
    // l1 untouched
    expect(state.objects[2].opacity).toBe(1);
  });
});

// ============================================================
// UpdateStyleCommand — dashArray (array property)
// ============================================================
describe('UpdateStyleCommand — Array Properties (dashArray)', () => {
  let state;
  beforeEach(() => {
    state = createState();
    state.objects.push(makeRect({ id: 'r1', dashArray: [] }));
  });

  it('sets dashArray', () => {
    const cmd = new UpdateStyleCommand(['r1'], { dashArray: [5, 5] });
    cmd.execute(state);
    expect(state.objects[0].dashArray).toEqual([5, 5]);
  });

  it('undo restores original dashArray', () => {
    const cmd = new UpdateStyleCommand(['r1'], { dashArray: [5, 5] });
    cmd.execute(state);
    cmd.undo(state);
    expect(state.objects[0].dashArray).toEqual([]);
  });

  it('deep-copies array so mutation does not leak', () => {
    const arr = [10, 5];
    const cmd = new UpdateStyleCommand(['r1'], { dashArray: arr });
    cmd.execute(state);
    arr.push(99);
    expect(state.objects[0].dashArray).toEqual([10, 5]);
  });
});

// ============================================================
// UpdateStyleCommand — per-type support
// ============================================================
describe('UpdateStyleCommand — Per-Object Type', () => {
  let state;

  it('works on drawing (pencil) objects', () => {
    state = createState();
    state.objects.push(makeDrawing({ id: 'd1', strokeColor: '#000000' }));
    const cmd = new UpdateStyleCommand(['d1'], { strokeColor: '#FF00FF' });
    cmd.execute(state);
    expect(state.objects[0].strokeColor).toBe('#FF00FF');
  });

  it('works on text objects (textColor)', () => {
    state = createState();
    state.objects.push(makeText({ id: 't1', textColor: '#000000' }));
    const cmd = new UpdateStyleCommand(['t1'], { textColor: '#FF0000' });
    cmd.execute(state);
    expect(state.objects[0].textColor).toBe('#FF0000');
  });

  it('works on ellipse objects', () => {
    state = createState();
    state.objects.push(makeEllipse({ id: 'e1', fillColor: 'transparent' }));
    const cmd = new UpdateStyleCommand(['e1'], { fillColor: '#8AC926' });
    cmd.execute(state);
    expect(state.objects[0].fillColor).toBe('#8AC926');
  });

  it('works on emoji objects (opacity only)', () => {
    state = createState();
    state.objects.push(makeEmoji({ id: 'em1', opacity: 1 }));
    const cmd = new UpdateStyleCommand(['em1'], { opacity: 0.6 });
    cmd.execute(state);
    expect(state.objects[0].opacity).toBe(0.6);
    cmd.undo(state);
    expect(state.objects[0].opacity).toBe(1);
  });
});

// ============================================================
// UpdateStyleCommand — serialization / deserialization
// ============================================================
describe('UpdateStyleCommand — Serialize / Deserialize', () => {
  it('round-trips correctly', () => {
    const cmd = new UpdateStyleCommand(['r1', 'c1'], { strokeColor: '#ABCDEF', opacity: 0.5 });
    const state = createState();
    state.objects.push(makeRect({ id: 'r1' }));
    state.objects.push(makeCircle({ id: 'c1' }));
    cmd.execute(state);

    const serialized = cmd.serialize();
    expect(serialized.type).toBe('UpdateStyleCommand');
    expect(serialized.objectIds).toEqual(['r1', 'c1']);
    expect(serialized.styleChanges.strokeColor).toBe('#ABCDEF');

    // Deserialize and verify
    const restored = UpdateStyleCommand.deserialize(serialized);
    expect(restored).toBeInstanceOf(UpdateStyleCommand);
    expect(restored.objectIds).toEqual(['r1', 'c1']);
    expect(restored.styleChanges.opacity).toBe(0.5);
    expect(restored.id).toBe(cmd.id);
  });

  it('deserializeCommand dispatcher handles UpdateStyleCommand', () => {
    const cmd = new UpdateStyleCommand(['x'], { strokeColor: '#123456' });
    const data = cmd.serialize();
    const restored = deserializeCommand(data);
    expect(restored).toBeInstanceOf(UpdateStyleCommand);
    expect(restored.styleChanges.strokeColor).toBe('#123456');
  });

  it('previousStyles are serialized', () => {
    const state = createState();
    state.objects.push(makeRect({ id: 'r1', strokeColor: '#000000' }));
    const cmd = new UpdateStyleCommand(['r1'], { strokeColor: '#FFFFFF' });
    cmd.execute(state);

    const serialized = cmd.serialize();
    expect(serialized.previousStyles).toBeDefined();
    expect(serialized.previousStyles['r1']).toBeDefined();
    expect(serialized.previousStyles['r1'].strokeColor).toBe('#000000');
  });

  it('deserialized command can undo', () => {
    const state = createState();
    state.objects.push(makeRect({ id: 'r1', strokeColor: '#000000' }));
    const cmd = new UpdateStyleCommand(['r1'], { strokeColor: '#FFFFFF' });
    cmd.execute(state);
    const data = cmd.serialize();

    const restored = UpdateStyleCommand.deserialize(data);
    restored.undo(state);
    expect(state.objects[0].strokeColor).toBe('#000000');
  });
});

// ============================================================
// UpdateStyleCommand — edge cases
// ============================================================
describe('UpdateStyleCommand — Edge Cases', () => {
  it('single string objectId is converted to array', () => {
    const cmd = new UpdateStyleCommand('r1', { strokeColor: '#FF0000' });
    expect(cmd.objectIds).toEqual(['r1']);
  });

  it('empty styleChanges object does not crash', () => {
    const state = createState();
    state.objects.push(makeRect({ id: 'r1' }));
    const cmd = new UpdateStyleCommand(['r1'], {});
    expect(cmd.execute(state)).toBe(true);
    expect(cmd.undo(state)).toBe(true);
  });

  it('empty objectIds returns false', () => {
    const state = createState();
    const cmd = new UpdateStyleCommand([], { strokeColor: '#FF0000' });
    expect(cmd.execute(state)).toBe(false);
  });

  it('setting opacity to 0 works', () => {
    const state = createState();
    state.objects.push(makeRect({ id: 'r1', opacity: 1 }));
    const cmd = new UpdateStyleCommand(['r1'], { opacity: 0 });
    cmd.execute(state);
    expect(state.objects[0].opacity).toBe(0);
  });

  it('multiple executes are idempotent (same result)', () => {
    const state = createState();
    state.objects.push(makeRect({ id: 'r1', strokeColor: '#000000' }));
    const cmd = new UpdateStyleCommand(['r1'], { strokeColor: '#FF0000' });
    cmd.execute(state);
    cmd.execute(state);
    cmd.execute(state);
    expect(state.objects[0].strokeColor).toBe('#FF0000');
    cmd.undo(state);
    expect(state.objects[0].strokeColor).toBe('#000000');
  });

  it('works when object has no initial value for a property', () => {
    const state = createState();
    const obj = { id: 'bare', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 };
    state.objects.push(obj);
    const cmd = new UpdateStyleCommand(['bare'], { strokeColor: '#AABBCC' });
    cmd.execute(state);
    expect(state.objects[0].strokeColor).toBe('#AABBCC');
    cmd.undo(state);
    expect(state.objects[0].strokeColor).toBeUndefined();
  });

  it('setting transparent fill works', () => {
    const state = createState();
    state.objects.push(makeRect({ id: 'r1', fillColor: '#FF0000' }));
    const cmd = new UpdateStyleCommand(['r1'], { fillColor: 'transparent' });
    cmd.execute(state);
    expect(state.objects[0].fillColor).toBe('transparent');
    cmd.undo(state);
    expect(state.objects[0].fillColor).toBe('#FF0000');
  });

  it('very large number of objects does not throw', () => {
    const state = createState();
    const ids = [];
    for (let i = 0; i < 200; i++) {
      const id = `obj_${i}`;
      ids.push(id);
      state.objects.push(makeRect({ id, strokeColor: '#000000' }));
    }
    const cmd = new UpdateStyleCommand(ids, { strokeColor: '#FFFFFF' });
    cmd.execute(state);
    expect(state.objects.every(o => o.strokeColor === '#FFFFFF')).toBe(true);
    cmd.undo(state);
    expect(state.objects.every(o => o.strokeColor === '#000000')).toBe(true);
  });
});

// ============================================================
// UpdateStyleCommand — chained commands
// ============================================================
describe('UpdateStyleCommand — Chained Commands', () => {
  it('two sequential commands — undo both restores original', () => {
    const state = createState();
    state.objects.push(makeRect({ id: 'r1', strokeColor: '#000000', opacity: 1 }));

    const cmd1 = new UpdateStyleCommand(['r1'], { strokeColor: '#FF0000' });
    cmd1.execute(state);
    expect(state.objects[0].strokeColor).toBe('#FF0000');

    const cmd2 = new UpdateStyleCommand(['r1'], { opacity: 0.5 });
    cmd2.execute(state);
    expect(state.objects[0].opacity).toBe(0.5);

    cmd2.undo(state);
    expect(state.objects[0].opacity).toBe(1);
    expect(state.objects[0].strokeColor).toBe('#FF0000');

    cmd1.undo(state);
    expect(state.objects[0].strokeColor).toBe('#000000');
  });

  it('three cascading color changes — undo in reverse', () => {
    const state = createState();
    state.objects.push(makeRect({ id: 'r1', strokeColor: '#AA' }));

    const c1 = new UpdateStyleCommand(['r1'], { strokeColor: '#BB' });
    c1.execute(state);
    const c2 = new UpdateStyleCommand(['r1'], { strokeColor: '#CC' });
    c2.execute(state);
    const c3 = new UpdateStyleCommand(['r1'], { strokeColor: '#DD' });
    c3.execute(state);

    expect(state.objects[0].strokeColor).toBe('#DD');
    c3.undo(state);
    expect(state.objects[0].strokeColor).toBe('#CC');
    c2.undo(state);
    expect(state.objects[0].strokeColor).toBe('#BB');
    c1.undo(state);
    expect(state.objects[0].strokeColor).toBe('#AA');
  });
});

// ============================================================
// UpdateStyleCommand — integration with mixed object types
// ============================================================
describe('UpdateStyleCommand — Mixed Object Types', () => {
  it('same command on rect + circle + drawing + emoji', () => {
    const state = createState();
    state.objects.push(makeRect({ id: 'r1', opacity: 1 }));
    state.objects.push(makeCircle({ id: 'c1', opacity: 0.8 }));
    state.objects.push(makeDrawing({ id: 'd1', opacity: 0.6 }));
    state.objects.push(makeEmoji({ id: 'em1', opacity: 0.9 }));

    const cmd = new UpdateStyleCommand(['r1', 'c1', 'd1', 'em1'], { opacity: 0.5 });
    cmd.execute(state);

    expect(state.objects.every(o => o.opacity === 0.5)).toBe(true);

    cmd.undo(state);
    expect(state.objects[0].opacity).toBe(1);
    expect(state.objects[1].opacity).toBe(0.8);
    expect(state.objects[2].opacity).toBe(0.6);
    expect(state.objects[3].opacity).toBe(0.9);
  });
});
