// src/components/canvas/ToolOptionsPanel.jsx
import { useState, useEffect } from 'react';
import { TOOL_TYPES } from "@shared/constants";
import {
  PencilOptions,
  ShapeOptions,
  EraserOptions,
  EmojiOptions,
  StickyNoteOptions,
} from "./tool-options";

const TOOL_OPTIONS_MAP = {
  [TOOL_TYPES.PENCIL]: PencilOptions,
  [TOOL_TYPES.SHAPE]: ShapeOptions,
  [TOOL_TYPES.ERASER]: EraserOptions,
  [TOOL_TYPES.OBJECT_ERASER]: EraserOptions,
  [TOOL_TYPES.EMOJI]: EmojiOptions,
  [TOOL_TYPES.STICKY]: StickyNoteOptions,
};

// Tools that should dismiss their panel when the canvas is clicked
// (shape/pencil dismiss naturally via tool-switch; eraser does not)
const DISMISS_ON_CANVAS_CLICK = new Set([
  TOOL_TYPES.ERASER,
  TOOL_TYPES.OBJECT_ERASER,
]);

export default function ToolOptionsPanel({
  toolManager,
  activeTool,
  onToolChange,
  canvasManager,
}) {
  const [panelVisible, setPanelVisible] = useState(true);

  // Re-show panel whenever the active tool changes
  useEffect(() => {
    setPanelVisible(true);
  }, [activeTool]);

  // Dismiss panel when canvas is interacted with (for eraser etc.)
  useEffect(() => {
    if (!canvasManager || !DISMISS_ON_CANVAS_CLICK.has(activeTool)) return;
    const handler = () => setPanelVisible(false);
    canvasManager.on('canvas:interacted', handler);
    return () => canvasManager.off('canvas:interacted', handler);
  }, [canvasManager, activeTool]);

  if (!toolManager || !panelVisible) return null;

  const OptionsComponent = TOOL_OPTIONS_MAP[activeTool];
  if (!OptionsComponent) return null;

  return (
    <div className="fixed left-24 top-1/2 -translate-y-1/2 z-50">
      <div className="bg-card border border-border rounded-lg shadow-lg w-auto p-3">
        <OptionsComponent
          toolManager={toolManager}
          activeTool={activeTool}
          onModeChange={onToolChange}
          canvasManager={canvasManager}
        />
      </div>
    </div>
  );
}