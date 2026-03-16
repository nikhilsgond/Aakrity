// src/components/canvas/tool-options/StickyNoteOptions.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AddShapeCommand, ShapeCommandFactory } from '../../engine/commands/ShapeCommands';

const DEFAULT_STICKY_SIZE = 200;

const NOTE_COLORS = [
  { key: 'yellow',   bg: '#FFF9C4', text: '#333333', label: 'Yellow' },
  { key: 'pink',     bg: '#F8BBD0', text: '#333333', label: 'Pink' },
  { key: 'blue',     bg: '#BBDEFB', text: '#333333', label: 'Blue' },
  { key: 'green',    bg: '#C8E6C9', text: '#333333', label: 'Green' },
  { key: 'orange',   bg: '#FFE0B2', text: '#333333', label: 'Orange' },
  { key: 'purple',   bg: '#E1BEE7', text: '#333333', label: 'Purple' },
  { key: 'coral',    bg: '#FFCCBC', text: '#333333', label: 'Coral' },
  { key: 'teal',     bg: '#B2DFDB', text: '#333333', label: 'Teal' },
  { key: 'lavender', bg: '#D1C4E9', text: '#333333', label: 'Lavender' },
  { key: 'lime',     bg: '#DCEDC8', text: '#333333', label: 'Lime' },
  { key: 'peach',    bg: '#FFE0CC', text: '#333333', label: 'Peach' },
  { key: 'slate',    bg: '#CFD8DC', text: '#333333', label: 'Slate' },
];

/**
 * Ghost element that follows the cursor during drag
 */
function DragGhost({ color, x, y }) {
  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999]"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
    >
      <div
        className="w-16 h-16 rounded-lg shadow-xl border border-black/10 opacity-80"
        style={{ backgroundColor: color }}
      />
    </div>,
    document.body
  );
}

/**
 * Extract canvasManager from toolManager by inspecting cached tool instances.
 */
function getCanvasManager(toolManager) {
  for (const [, instance] of toolManager.toolInstances) {
    if (instance?.canvasManager) return instance.canvasManager;
  }
  try {
    const selectTool = toolManager.getToolInstance('select');
    if (selectTool?.canvasManager) return selectTool.canvasManager;
  } catch (e) { /* noop */ }
  return null;
}

export default function StickyNoteOptions({ toolManager }) {
  const [selected, setSelected] = useState('yellow');
  const [dragging, setDragging] = useState(null); // { colorObj, x, y }
  const dragRef = useRef(null);

  useEffect(() => {
    if (!toolManager) return;
    const opts = toolManager.getOptions?.() || {};
    if (opts.noteColor) setSelected(opts.noteColor);
  }, [toolManager]);

  const handleSelect = (key) => {
    setSelected(key);
    toolManager?.setOption?.('noteColor', key);
  };

  // --- Drag & Drop ---
  const handleDragStart = useCallback((colorObj, e) => {
    e.preventDefault();
    dragRef.current = { colorObj, startX: e.clientX, startY: e.clientY };
    setDragging({ colorObj, x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e) => {
      setDragging((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    };

    const onUp = (e) => {
      const colorObj = dragRef.current?.colorObj;
      dragRef.current = null;
      setDragging(null);
      if (!colorObj || !toolManager) return;

      const canvasManager = getCanvasManager(toolManager);
      if (!canvasManager || !canvasManager.canvas) return;

      const canvasRect = canvasManager.canvas.getBoundingClientRect();
      const cx = e.clientX;
      const cy = e.clientY;

      // Check if dropped on canvas
      if (
        cx >= canvasRect.left &&
        cx <= canvasRect.right &&
        cy >= canvasRect.top &&
        cy <= canvasRect.bottom
      ) {
        const relX = cx - canvasRect.left;
        const relY = cy - canvasRect.top;
        const worldPos = canvasManager.screenToWorld(relX, relY);

        const size = DEFAULT_STICKY_SIZE;
        const shapeData = {
          id: ShapeCommandFactory.generateShapeId(),
          type: 'sticky',
          x: worldPos.x - size / 2,
          y: worldPos.y - size / 2,
          width: size,
          height: size,
          text: '',
          noteColor: colorObj.bg,
          textColor: colorObj.text,
          fontSize: 14,
          opacity: 1.0,
          rotation: 0,
          layer: 'default',
          visible: true,
          createdAt: Date.now(),
        };

        const command = new AddShapeCommand(shapeData);
        canvasManager.executeCommand(command);

        // Select the placed sticky, switch to select tool, open editor
        requestAnimationFrame(() => {
          if (command.objectId) {
            canvasManager.setSelection([command.objectId]);
          }
          const selectTool = toolManager.getToolInstance('select');
          if (selectTool) {
            canvasManager.setActiveTool(selectTool);
            toolManager.setActiveTool('select');
          }
          // Emit tool:changed so the UI state updates → closes sub-bar
          canvasManager.emit('tool:changed', { toolType: 'select' });
          canvasManager.requestRender();

          // Auto-open text editor
          if (command.objectId) {
            requestAnimationFrame(() => {
              canvasManager.emit('sticky:edit', { objectId: command.objectId, point: null });
            });
          }
        });

        // Also set this as the selected color for click-to-place
        handleSelect(colorObj.key);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, toolManager, handleSelect]);

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-muted-foreground">Sticky Note Color</h4>
      <div className="grid grid-cols-4 gap-2">
        {NOTE_COLORS.map((c) => (
          <button
            key={c.key}
            onClick={() => handleSelect(c.key)}
            onMouseDown={(e) => handleDragStart(c, e)}
            className={`w-full aspect-square rounded-lg border-2 transition-all cursor-grab active:cursor-grabbing hover:scale-105 ${
              selected === c.key
                ? 'border-primary ring-2 ring-primary/30'
                : 'border-gray-300 dark:border-gray-600'
            }`}
            style={{ backgroundColor: c.bg }}
            title={`${c.label} — click to select, drag to place`}
          />
        ))}
      </div>
      <div className="pt-1 border-t border-border">
        <span className="text-[10px] text-muted-foreground">Drag to canvas or click to select</span>
      </div>

      {/* Drag ghost portal */}
      {dragging && <DragGhost color={dragging.colorObj.bg} x={dragging.x} y={dragging.y} />}
    </div>
  );
}
