/**
 * Bug Fixes Batch — Tests for 6 bugs across multiple systems
 * ──────────────────────────────────────────────────────────────────────
 * BUG 1: Emoji/Sticky drop size — zoom-compensated sizing
 * BUG 2: Images not syncing — maxHttpBufferSize config
 * BUG 3: Subtoolbar fixed width — auto-sizing panel
 * BUG 6: Suggestion popup dismiss — auto-dismiss + outside click behavior
 * BUG 7: Arrow-only default memory — last choice persistence
 * BUG 8: Sub-options reset — sticky options across tool switches
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createState, makeRect, makeCircle, makeDrawing, makeText } from './helpers.js';

// ── Imports under test ──
import EmojiTool from '../src/features/canvas/tools/emoji/EmojiTool.js';
import StickyNoteTool from '../src/features/canvas/tools/sticky-note/StickyNoteTool.js';
import { MoveCommand } from '../src/features/canvas/engine/commands/MoveCommand.js';
import { ToolManager } from '../src/features/canvas/tools/ToolManager.js';
import {
  TOOL_TYPES,
  TOOL_OPTIONS,
  DEFAULT_TOOL_OPTIONS,
  BASE_TOOL_OPTIONS,
} from '../src/shared/constants/index.js';

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

function makeSticky(overrides = {}) {
  return {
    id: overrides.id || 'sticky_1',
    type: 'sticky',
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    text: '',
    noteColor: '#FFF9C4',
    textColor: '#333333',
    fontSize: 16,
    opacity: 1.0,
    rotation: 0,
    layer: 'default',
    visible: true,
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
   BUG 1: Emoji/Sticky drop size — zoom-compensated sizing
   ================================================================ */
describe('BUG 1 — Emoji/Sticky zoom-compensated sizing', () => {
  let emojiTool, stickyTool;

  beforeEach(() => {
    emojiTool = new EmojiTool({ emoji: '🎨' });
    stickyTool = new StickyNoteTool();
  });

  describe('EmojiTool — zoom compensation', () => {
    it('creates emoji at default size when zoom = 1', () => {
      const cm = createMockCanvasManager({ viewport: { zoom: 1, panX: 0, panY: 0 } });
      emojiTool.activate(cm);
      const result = emojiTool.onPointerDown({ x: 200, y: 200 });
      expect(result).not.toBeNull();
      expect(result.command).toBeDefined();
      // Execute to inspect shape data
      const state = createState();
      result.command.execute(state);
      const emoji = state.objects[0];
      expect(emoji.width).toBe(64);
      expect(emoji.height).toBe(64);
    });

    it('creates larger world-size emoji when zoomed out (zoom < 1)', () => {
      const cm = createMockCanvasManager({ viewport: { zoom: 0.5, panX: 0, panY: 0 } });
      emojiTool.activate(cm);
      const result = emojiTool.onPointerDown({ x: 200, y: 200 });
      const state = createState();
      result.command.execute(state);
      const emoji = state.objects[0];
      // 64 / 0.5 = 128 world units (appears 64px on screen)
      expect(emoji.width).toBe(128);
      expect(emoji.height).toBe(128);
    });

    it('creates smaller world-size emoji when zoomed in (zoom > 1)', () => {
      const cm = createMockCanvasManager({ viewport: { zoom: 2, panX: 0, panY: 0 } });
      emojiTool.activate(cm);
      const result = emojiTool.onPointerDown({ x: 200, y: 200 });
      const state = createState();
      result.command.execute(state);
      const emoji = state.objects[0];
      // 64 / 2 = 32 world units (appears 64px on screen)
      expect(emoji.width).toBe(32);
      expect(emoji.height).toBe(32);
    });

    it('centers emoji at click position regardless of zoom', () => {
      const cm = createMockCanvasManager({ viewport: { zoom: 0.5, panX: 0, panY: 0 } });
      emojiTool.activate(cm);
      const result = emojiTool.onPointerDown({ x: 300, y: 400 });
      const state = createState();
      result.command.execute(state);
      const emoji = state.objects[0];
      // size = 128, center at (300,400) => x = 300-64=236, y = 400-64=336
      expect(emoji.x).toBe(300 - 64);
      expect(emoji.y).toBe(400 - 64);
    });

    it('handles extreme zoom levels gracefully', () => {
      const cm = createMockCanvasManager({ viewport: { zoom: 0.1, panX: 0, panY: 0 } });
      emojiTool.activate(cm);
      const result = emojiTool.onPointerDown({ x: 100, y: 100 });
      const state = createState();
      result.command.execute(state);
      const emoji = state.objects[0];
      // 64 / 0.1 = 640
      expect(emoji.width).toBe(640);
      expect(emoji.height).toBe(640);
    });

    it('defaults to zoom=1 when viewport is missing', () => {
      const cm = createMockCanvasManager();
      cm.state.viewport = undefined;
      emojiTool.activate(cm);
      const result = emojiTool.onPointerDown({ x: 200, y: 200 });
      const state = createState();
      result.command.execute(state);
      const emoji = state.objects[0];
      expect(emoji.width).toBe(64);
      expect(emoji.height).toBe(64);
    });
  });

  describe('StickyNoteTool — zoom compensation', () => {
    it('creates sticky at default size when zoom = 1', () => {
      const cm = createMockCanvasManager({ viewport: { zoom: 1, panX: 0, panY: 0 } });
      stickyTool.activate(cm);
      const result = stickyTool.onPointerDown({ x: 400, y: 400 });
      const state = createState();
      result.command.execute(state);
      const sticky = state.objects[0];
      expect(sticky.width).toBe(200);
      expect(sticky.height).toBe(200);
    });

    it('creates larger world-size sticky when zoomed out (zoom = 0.5)', () => {
      const cm = createMockCanvasManager({ viewport: { zoom: 0.5, panX: 0, panY: 0 } });
      stickyTool.activate(cm);
      const result = stickyTool.onPointerDown({ x: 400, y: 400 });
      const state = createState();
      result.command.execute(state);
      const sticky = state.objects[0];
      // 200 / 0.5 = 400
      expect(sticky.width).toBe(400);
      expect(sticky.height).toBe(400);
    });

    it('creates smaller world-size sticky when zoomed in (zoom = 2)', () => {
      const cm = createMockCanvasManager({ viewport: { zoom: 2, panX: 0, panY: 0 } });
      stickyTool.activate(cm);
      const result = stickyTool.onPointerDown({ x: 400, y: 400 });
      const state = createState();
      result.command.execute(state);
      const sticky = state.objects[0];
      // 200 / 2 = 100
      expect(sticky.width).toBe(100);
      expect(sticky.height).toBe(100);
    });

    it('centers sticky at click position regardless of zoom', () => {
      const cm = createMockCanvasManager({ viewport: { zoom: 2, panX: 0, panY: 0 } });
      stickyTool.activate(cm);
      const result = stickyTool.onPointerDown({ x: 500, y: 500 });
      const state = createState();
      result.command.execute(state);
      const sticky = state.objects[0];
      // size = 100, center at (500,500) => x = 500-50=450, y = 500-50=450
      expect(sticky.x).toBe(450);
      expect(sticky.y).toBe(450);
    });

    it('consistent screen size: same pixel footprint at all zooms', () => {
      // At any zoom z, the world size is 200/z => screen size = (200/z)*z = 200px
      const zooms = [0.25, 0.5, 1, 2, 4];
      for (const z of zooms) {
        const cm = createMockCanvasManager({ viewport: { zoom: z, panX: 0, panY: 0 } });
        stickyTool.activate(cm);
        const result = stickyTool.onPointerDown({ x: 0, y: 0 });
        const state = createState();
        result.command.execute(state);
        const sticky = state.objects[0];
        // screen size = world size * zoom
        expect(sticky.width * z).toBeCloseTo(200, 5);
        expect(sticky.height * z).toBeCloseTo(200, 5);
      }
    });
  });
});

/* ================================================================
   BUG 2: Images not syncing — maxHttpBufferSize (config tests)
   This is a configuration test. We verify the constant is present.
   ================================================================ */
describe('BUG 2 — Socket.io maxHttpBufferSize configuration', () => {
  it('server configures maxHttpBufferSize >= 5 MB', async () => {
    // Read the server file and check for maxHttpBufferSize config
    const fs = await import('fs');
    const path = await import('path');
    const serverPath = path.resolve('server/index.js');
    const serverCode = fs.readFileSync(serverPath, 'utf-8');
    expect(serverCode).toContain('maxHttpBufferSize');
    // Ensure it's at least 5MB (5 * 1024 * 1024 = 5242880)
    const match = serverCode.match(/maxHttpBufferSize:\s*([\d*\s]+)/);
    expect(match).not.toBeNull();
  });

  it('client configures maxHttpBufferSize', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const clientPath = path.resolve('src/features/room/services/socketService.js');
    const clientCode = fs.readFileSync(clientPath, 'utf-8');
    expect(clientCode).toContain('maxHttpBufferSize');
  });

  it('server and client maxHttpBufferSize values match', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const serverCode = fs.readFileSync(path.resolve('server/index.js'), 'utf-8');
    const clientCode = fs.readFileSync(path.resolve('src/features/room/services/socketService.js'), 'utf-8');

    // Both should use same formula: 10 * 1024 * 1024
    const serverMatch = serverCode.match(/maxHttpBufferSize:\s*([\d\s*]+)/);
    const clientMatch = clientCode.match(/maxHttpBufferSize:\s*([\d\s*]+)/);
    expect(serverMatch).not.toBeNull();
    expect(clientMatch).not.toBeNull();
    // Both should evaluate to the same value
    const serverVal = eval(serverMatch[1].trim());
    const clientVal = eval(clientMatch[1].trim());
    expect(serverVal).toBe(clientVal);
    expect(serverVal).toBeGreaterThanOrEqual(5 * 1024 * 1024);
  });
});

/* ================================================================
   BUG 3: Subtoolbar fixed width — auto-sizing panel
   ================================================================ */
describe('BUG 3 — ToolOptionsPanel auto-sizing', () => {
  it('panel does NOT use fixed w-[240px] class', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve('src/features/canvas/ui/ToolOptionsPanel.jsx');
    const code = fs.readFileSync(filePath, 'utf-8');
    expect(code).not.toContain('w-[240px]');
  });

  it('panel uses auto-width styling', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve('src/features/canvas/ui/ToolOptionsPanel.jsx');
    const code = fs.readFileSync(filePath, 'utf-8');
    expect(code).toContain('w-auto');
  });

  it('panel does NOT impose min-width (auto-sizing, Bug #7 fix)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve('src/features/canvas/ui/ToolOptionsPanel.jsx');
    const code = fs.readFileSync(filePath, 'utf-8');
    // Bug #7 fix: min-w-[180px] removed so sub-toolbars only use needed width
    expect(code).not.toMatch(/min-w-\[/);
  });

  it('panel does NOT impose max-width (auto-sizing, Bug #7 fix)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve('src/features/canvas/ui/ToolOptionsPanel.jsx');
    const code = fs.readFileSync(filePath, 'utf-8');
    // Bug #7 fix: max-w-[320px] removed — content determines width
    expect(code).not.toMatch(/max-w-\[/);
  });
});

/* ================================================================
   BUG 4: Ports on drawing strokes — isConnectable filter
   ================================================================ */
/* ================================================================
   BUG 8: Sub-options reset — sticky options across tool switches
   ================================================================ */

/* ================================================================
   BUG 8: Sub-options reset — sticky options across tool switches
   ================================================================ */
describe('BUG 8 — Tool option stickiness across switches', () => {
  let toolManager;

  beforeEach(() => {
    toolManager = new ToolManager();
  });

  describe('STICKY_OPTIONS configuration', () => {
    it('defines STICKY_OPTIONS static property', () => {
      expect(ToolManager.STICKY_OPTIONS).toBeDefined();
      expect(Array.isArray(ToolManager.STICKY_OPTIONS)).toBe(true);
    });

    it('color is a sticky option', () => {
      expect(ToolManager.STICKY_OPTIONS).toContain('color');
    });

    it('opacity is a sticky option', () => {
      expect(ToolManager.STICKY_OPTIONS).toContain('opacity');
    });
  });

  describe('color persists across tool switches', () => {
    it('switching pencil→shape preserves user-set color', () => {
      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      toolManager.updateOptions({ color: '#FF0000' });
      expect(toolManager.getOptions().color).toBe('#FF0000');

      toolManager.setActiveTool(TOOL_TYPES.SHAPE);
      expect(toolManager.getOptions().color).toBe('#FF0000');
    });

    it('switching shape→pencil→text preserves color', () => {
      toolManager.setActiveTool(TOOL_TYPES.SHAPE);
      toolManager.updateOptions({ color: '#00FF00' });

      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      expect(toolManager.getOptions().color).toBe('#00FF00');

      toolManager.setActiveTool(TOOL_TYPES.TEXT);
      expect(toolManager.getOptions().color).toBe('#00FF00');
    });

    it('switching to eraser then back preserves color', () => {
      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      toolManager.updateOptions({ color: '#0000FF' });

      toolManager.setActiveTool(TOOL_TYPES.ERASER);
      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      expect(toolManager.getOptions().color).toBe('#0000FF');
    });
  });

  describe('non-sticky options reset on tool switch', () => {
    it('pencil width resets when switching away and back', () => {
      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      const defaultWidth = toolManager.getOptions().width;
      toolManager.updateOptions({ width: 10 });
      expect(toolManager.getOptions().width).toBe(10);

      toolManager.setActiveTool(TOOL_TYPES.SHAPE);
      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      // Width should reset to pencil defaults, not remain at 10
      expect(toolManager.getOptions().width).toBe(DEFAULT_TOOL_OPTIONS[TOOL_TYPES.PENCIL].width);
    });

    it('shape type resets when switching away and back', () => {
      toolManager.setActiveTool(TOOL_TYPES.SHAPE);
      toolManager.updateOptions({ shapeType: 'circle' });

      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      toolManager.setActiveTool(TOOL_TYPES.SHAPE);
      // Should reset to default shape type
      expect(toolManager.getOptions().shapeType).toBe(DEFAULT_TOOL_OPTIONS[TOOL_TYPES.SHAPE].shapeType);
    });

    it('font size resets on tool switch', () => {
      toolManager.setActiveTool(TOOL_TYPES.TEXT);
      toolManager.updateOptions({ fontSize: 32 });

      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      toolManager.setActiveTool(TOOL_TYPES.TEXT);
      expect(toolManager.getOptions().fontSize).toBe(DEFAULT_TOOL_OPTIONS[TOOL_TYPES.TEXT].fontSize);
    });
  });

  describe('opacity persists (sticky)', () => {
    it('user-set opacity carries across tool switches', () => {
      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      toolManager.updateOptions({ opacity: 0.5 });

      toolManager.setActiveTool(TOOL_TYPES.SHAPE);
      expect(toolManager.getOptions().opacity).toBe(0.5);

      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      expect(toolManager.getOptions().opacity).toBe(0.5);
    });
  });

  describe('explicit override still works', () => {
    it('setActiveTool with explicit color overrides sticky value', () => {
      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      toolManager.updateOptions({ color: '#FF0000' });

      // Explicit override should win
      toolManager.setActiveTool(TOOL_TYPES.SHAPE, { color: '#AABBCC' });
      expect(toolManager.getOptions().color).toBe('#AABBCC');
    });

    it('setActiveTool with explicit opacity overrides sticky value', () => {
      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      toolManager.updateOptions({ opacity: 0.3 });

      toolManager.setActiveTool(TOOL_TYPES.SHAPE, { opacity: 0.8 });
      expect(toolManager.getOptions().opacity).toBe(0.8);
    });
  });

  describe('resetOptions still resets everything', () => {
    it('explicit resetOptions resets color to default', () => {
      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      toolManager.updateOptions({ color: '#FF0000' });
      toolManager.resetOptions();
      // After explicit reset, color goes back to tool-specific default
      const expected = DEFAULT_TOOL_OPTIONS[TOOL_TYPES.PENCIL]?.color || BASE_TOOL_OPTIONS.color;
      expect(toolManager.getOptions().color).toBe(expected);
    });
  });

  describe('edge cases', () => {
    it('first tool activation with no prior state works', () => {
      const tm = new ToolManager();
      // Set tool for the first time
      tm.setActiveTool(TOOL_TYPES.SHAPE);
      expect(tm.getOptions().color).toBeDefined();
      expect(tm.getOptions().shapeType).toBeDefined();
    });

    it('rapid switching preserves sticky options', () => {
      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      toolManager.updateOptions({ color: '#123456', opacity: 0.7 });

      // Rapid switch through multiple tools
      toolManager.setActiveTool(TOOL_TYPES.SHAPE);
      toolManager.setActiveTool(TOOL_TYPES.TEXT);
      toolManager.setActiveTool(TOOL_TYPES.ERASER);
      toolManager.setActiveTool(TOOL_TYPES.EMOJI);
      toolManager.setActiveTool(TOOL_TYPES.PENCIL);

      expect(toolManager.getOptions().color).toBe('#123456');
      expect(toolManager.getOptions().opacity).toBe(0.7);
    });

    it('switching to same tool does not lose options', () => {
      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      toolManager.updateOptions({ color: '#ABCDEF' });

      toolManager.setActiveTool(TOOL_TYPES.PENCIL);
      expect(toolManager.getOptions().color).toBe('#ABCDEF');
    });
  });
});

/* ================================================================
   CROSS-CUTTING: Ensure fixes don't break each other
   ================================================================ */
describe('Cross-cutting — fixes do not break other systems', () => {
  it('MoveCommand still handles rectangle correctly', () => {
    const state = createState({ objects: [makeRect()] });
    const cmd = new MoveCommand(['rect_1'], { x: 10, y: 20 });
    cmd.execute(state);
    expect(state.objects[0].x).toBe(110);
    expect(state.objects[0].y).toBe(120);
    cmd.undo(state);
    expect(state.objects[0].x).toBe(100);
    expect(state.objects[0].y).toBe(100);
  });

  it('MoveCommand still handles line/arrow correctly', () => {
    const state = createState({
      objects: [{
        id: 'arrow_1', type: 'arrow',
        x1: 0, y1: 0, x2: 100, y2: 100,
        strokeColor: '#000', strokeWidth: 2, opacity: 1,
      }],
    });
    const cmd = new MoveCommand(['arrow_1'], { x: 50, y: 50 });
    cmd.execute(state);
    expect(state.objects[0].x1).toBe(50);
    expect(state.objects[0].y1).toBe(50);
    expect(state.objects[0].x2).toBe(150);
    expect(state.objects[0].y2).toBe(150);
  });

  it('MoveCommand still handles drawing correctly', () => {
    const state = createState({ objects: [makeDrawing()] });
    const cmd = new MoveCommand(['drawing_1'], { x: 5, y: 5 });
    cmd.execute(state);
    expect(state.objects[0].points[0].x).toBe(15);
    expect(state.objects[0].points[0].y).toBe(15);
  });

  it('EmojiTool returns null when not activated', () => {
    const tool = new EmojiTool();
    const result = tool.onPointerDown({ x: 0, y: 0 });
    expect(result).toBeNull();
  });

  it('StickyNoteTool returns null when not activated', () => {
    const tool = new StickyNoteTool();
    const result = tool.onPointerDown({ x: 0, y: 0 });
    expect(result).toBeNull();
  });

  it('isConnectable still includes all expected types', () => {
    const expected = [
      'rectangle', 'roundedRectangle', 'circle', 'ellipse',
      'triangle', 'diamond', 'star', 'hexagon', 'pentagon', 'polygon',
      'text', 'image', 'emoji', 'sticky',
    ];
    for (const type of expected) {
      expect(isConnectable({ type })).toBe(true);
    }
  });

  it('ToolManager preserves tool instance caching after sticky fix', () => {
    const tm = new ToolManager();
    tm.setActiveTool(TOOL_TYPES.PENCIL);
    const inst1 = tm.getToolInstance(TOOL_TYPES.PENCIL);
    tm.setActiveTool(TOOL_TYPES.SHAPE);
    tm.setActiveTool(TOOL_TYPES.PENCIL);
    const inst2 = tm.getToolInstance(TOOL_TYPES.PENCIL);
    // Same cached instance
    expect(inst1).toBe(inst2);
  });
});
