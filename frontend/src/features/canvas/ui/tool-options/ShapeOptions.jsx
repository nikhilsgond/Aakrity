// src/components/canvas/tool-options/ShapeOptions.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Square,
  Circle,
  Minus,
  Triangle,
  ArrowRight,
  Octagon,
  Pentagon,
  Hexagon,
  Star
} from 'lucide-react';
import { SHAPE_TYPES, TOOL_OPTIONS } from '@shared/constants';
import { ShapeCommandFactory } from '../../engine/commands/ShapeCommands';

const SHAPES = [
  { id: SHAPE_TYPES.RECTANGLE, icon: Square, label: 'Rect' },
  { id: SHAPE_TYPES.CIRCLE, icon: Circle, label: 'Circle' },
  { id: SHAPE_TYPES.ELLIPSE, icon: Circle, label: 'Ellipse' },
  { id: SHAPE_TYPES.LINE, icon: Minus, label: 'Line' },
  { id: SHAPE_TYPES.ARROW, icon: ArrowRight, label: 'Arrow' },
  { id: SHAPE_TYPES.TRIANGLE, icon: Triangle, label: 'Triangle' },
  { id: SHAPE_TYPES.DIAMOND, icon: Octagon, label: 'Diamond' },
  { id: SHAPE_TYPES.HEXAGON, icon: Hexagon, label: 'Hexagon' },
  { id: SHAPE_TYPES.PENTAGON, icon: Pentagon, label: 'Pentagon' },
  { id: SHAPE_TYPES.STAR, icon: Star, label: 'Star' },
];

const DEFAULT_R = 60;
const DEFAULT_W = 120;
const DEFAULT_H = 80;

function calcPoints(shapeType, cx, cy) {
  const r = DEFAULT_R;
  switch (shapeType) {
    case SHAPE_TYPES.TRIANGLE:
      return [
        { x: cx, y: cy - r },
        { x: cx - r, y: cy + r },
        { x: cx + r, y: cy + r },
      ];
    case SHAPE_TYPES.DIAMOND:
      return [
        { x: cx, y: cy - r },
        { x: cx + r, y: cy },
        { x: cx, y: cy + r },
        { x: cx - r, y: cy },
      ];
    case SHAPE_TYPES.HEXAGON: {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      return pts;
    }
    case SHAPE_TYPES.PENTAGON: {
      const pts = [];
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      return pts;
    }
    case SHAPE_TYPES.STAR: {
      const pts = [];
      const innerR = r / 2;
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r : innerR;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
      }
      return pts;
    }
    default:
      return [];
  }
}

function createShapeAtPos(shapeType, worldX, worldY, toolManager, canvasManager) {
  const opts = {
    strokeColor: toolManager?.getOptions?.()?.color || '#000000',
    strokeWidth: toolManager?.getOptions?.()?.width || 2,
    fillColor: toolManager?.getOptions?.()?.fillColor || 'transparent',
    opacity: 1.0,
    layer: canvasManager?.state?.currentLayer || 'default',
  };
  switch (shapeType) {
    case SHAPE_TYPES.RECTANGLE:
      return ShapeCommandFactory.createRectangle(worldX - DEFAULT_W / 2, worldY - DEFAULT_H / 2, DEFAULT_W, DEFAULT_H, opts);
    case SHAPE_TYPES.CIRCLE:
      return ShapeCommandFactory.createCircle(worldX, worldY, DEFAULT_R, opts);
    case SHAPE_TYPES.ELLIPSE:
      return ShapeCommandFactory.createEllipse(worldX, worldY, DEFAULT_R, DEFAULT_R * 0.65, opts);
    case SHAPE_TYPES.LINE:
      return ShapeCommandFactory.createLine(worldX - DEFAULT_R, worldY, worldX + DEFAULT_R, worldY, opts);
    case SHAPE_TYPES.ARROW:
      return ShapeCommandFactory.createArrow(worldX - DEFAULT_R, worldY, worldX + DEFAULT_R, worldY, { ...opts, arrowSize: 10 });
    case SHAPE_TYPES.TRIANGLE:
      return ShapeCommandFactory.createTriangle(calcPoints(SHAPE_TYPES.TRIANGLE, worldX, worldY), opts);
    case SHAPE_TYPES.DIAMOND:
      return ShapeCommandFactory.createDiamond(calcPoints(SHAPE_TYPES.DIAMOND, worldX, worldY), opts);
    case SHAPE_TYPES.HEXAGON:
      return ShapeCommandFactory.createHexagon(calcPoints(SHAPE_TYPES.HEXAGON, worldX, worldY), opts);
    case SHAPE_TYPES.PENTAGON:
      return ShapeCommandFactory.createPentagon(calcPoints(SHAPE_TYPES.PENTAGON, worldX, worldY), opts);
    case SHAPE_TYPES.STAR:
      return ShapeCommandFactory.createStar(calcPoints(SHAPE_TYPES.STAR, worldX, worldY), opts);
    default:
      return ShapeCommandFactory.createRectangle(worldX - DEFAULT_W / 2, worldY - DEFAULT_H / 2, DEFAULT_W, DEFAULT_H, opts);
  }
}

/** Ghost element that follows the cursor during shape drag */
function DragGhost({ IconComponent, x, y }) {
  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999] bg-card border border-primary rounded-lg p-2 shadow-lg opacity-80"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
    >
      <IconComponent className="w-5 h-5 text-primary" />
    </div>,
    document.body
  );
}

function getCanvasManager(toolManager) {
  if (!toolManager) return null;
  for (const [, instance] of toolManager.toolInstances) {
    if (instance?.canvasManager) return instance.canvasManager;
  }
  return null;
}

export default function ShapeOptions({ toolManager }) {
  const [selected, setSelected] = useState(() => {
    if (!toolManager) return SHAPE_TYPES.RECTANGLE;
    return toolManager.getOptions()[TOOL_OPTIONS.SHAPE_TYPE] || SHAPE_TYPES.RECTANGLE;
  });

  // Drag state
  const [dragging, setDragging] = useState(null); // { shapeId, IconComponent, x, y }
  const dragRef = useRef(null);

  useEffect(() => {
    if (!toolManager) return;
    const options = toolManager.getOptions();
    const currentShape = options[TOOL_OPTIONS.SHAPE_TYPE];
    if (currentShape && currentShape !== selected) {
      setSelected(currentShape);
    }
  }, [toolManager, toolManager?.getOptions()]);

  const handleShapeClick = (shape) => {
    if (!toolManager) return;
    setSelected(shape.id);
    toolManager.setShapeType(shape.id);
    try {
      const shapeTool = toolManager.getToolInstance('shape');
      if (shapeTool?.setOptions) {
        shapeTool.setOptions({ [TOOL_OPTIONS.SHAPE_TYPE]: shape.id });
      }
    } catch (e) {
      // noop
    }
  };

  const handleDragStart = useCallback((shape, e) => {
    e.preventDefault();
    dragRef.current = { shape };
    setDragging({ shapeId: shape.id, IconComponent: shape.icon, x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e) => {
      setDragging(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    };

    const onUp = (e) => {
      const shape = dragRef.current?.shape;
      dragRef.current = null;
      setDragging(null);
      if (!shape || !toolManager) return;

      const canvasManager = getCanvasManager(toolManager);
      if (!canvasManager?.canvas) return;

      const canvasRect = canvasManager.canvas.getBoundingClientRect();
      const cx = e.clientX;
      const cy = e.clientY;

      if (
        cx >= canvasRect.left && cx <= canvasRect.right &&
        cy >= canvasRect.top && cy <= canvasRect.bottom
      ) {
        const relX = cx - canvasRect.left;
        const relY = cy - canvasRect.top;
        const worldPos = canvasManager.screenToWorld(relX, relY);

        const command = createShapeAtPos(shape.id, worldPos.x, worldPos.y, toolManager, canvasManager);
        if (command) {
          canvasManager.executeCommand(command);

          // Select the placed shape and switch to select tool
          requestAnimationFrame(() => {
            if (command.objectId) {
              canvasManager.setSelection([command.objectId]);
            }
            const selectTool = toolManager.getToolInstance('select');
            if (selectTool) {
              canvasManager.setActiveTool(selectTool);
              toolManager.setActiveTool?.('select');
            }
          });

          // Also set the selected shape type for click-to-draw
          handleShapeClick(shape);
        }
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, toolManager, handleShapeClick]);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 w-auto">
        {SHAPES.map((shape) => (
          <button
            key={shape.id}
            onClick={() => handleShapeClick(shape)}
            onMouseDown={(e) => handleDragStart(shape, e)}
            className={`relative p-2 rounded-lg transition-all duration-200 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing ${
              selected === shape.id
                ? 'bg-primary/10 shadow-[inset_0_0_0_2px] shadow-primary'
                : 'hover:bg-muted/50'
            }`}
            title={`${shape.label} — click to select, drag to place`}
          >
            <shape.icon
              className={`w-4 h-4 transition-colors ${
                selected === shape.id ? 'text-primary' : 'text-muted-foreground'
              }`}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 pt-1 border-t border-border">
        <span className="text-[10px] text-muted-foreground">Drag to canvas or click to select</span>
      </div>
      {dragging && <DragGhost IconComponent={dragging.IconComponent} x={dragging.x} y={dragging.y} />}
    </>
  );
}
