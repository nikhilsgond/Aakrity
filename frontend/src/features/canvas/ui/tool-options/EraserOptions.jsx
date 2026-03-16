// src/components/canvas/tool-options/EraserOptions.jsx
// ──────────────────────────────────────────────────────────────────────
// Compact sub-panel for eraser tools: mode toggle + vertical size slider.
// Options (mode + size) are persisted across dismiss/reopen via module-level vars.
// ──────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { Pencil, MousePointer2 } from 'lucide-react';
import { TOOL_TYPES } from '@shared/constants';

const ERASER_MODES = [
  {
    id: 'precision',
    toolType: TOOL_TYPES.ERASER,
    icon: Pencil,
    label: 'Stroke',
    description: 'Erase parts of strokes',
  },
  {
    id: 'object',
    toolType: TOOL_TYPES.OBJECT_ERASER,
    icon: MousePointer2,
    label: 'Object',
    description: 'Erase entire objects',
  },
];

const WIDTH_MIN = 4;
const WIDTH_MAX = 80;
const WIDTH_DEFAULT = 10;

// Module-level persistence — survives panel dismiss/remount until the tool changes
let _persistedMode = 'precision';
let _persistedWidth = WIDTH_DEFAULT;

export default function EraserOptions({ toolManager, activeTool, onModeChange }) {
  const [mode, setMode] = useState(
    activeTool === TOOL_TYPES.OBJECT_ERASER ? 'object' : _persistedMode
  );
  const [width, setWidth] = useState(_persistedWidth);

  // prevToolRef is initialised to activeTool so the first-mount effect is a no-op;
  // this prevents the panel remount (panelRevealKey increment) from overwriting
  // _persistedMode when the eraser tool hasn't actually changed.
  const prevToolRef = useRef(activeTool);

  // Only reset when the active tool genuinely transitions between tools.
  useEffect(() => {
    const prevTool = prevToolRef.current;
    prevToolRef.current = activeTool;

    // No real change (e.g. panel remount while still on the same eraser) — skip.
    if (prevTool === activeTool) return;

    if (activeTool === TOOL_TYPES.OBJECT_ERASER) {
      setMode('object');
      _persistedMode = 'object';
    } else if (activeTool === TOOL_TYPES.ERASER) {
      // Restore persisted mode instead of blindly resetting to 'precision'.
      setMode(_persistedMode);
    }
  }, [activeTool]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    _persistedMode = newMode;
    const modeConfig = ERASER_MODES.find(m => m.id === newMode);
    if (modeConfig && onModeChange) {
      onModeChange(modeConfig.toolType);
    }
  };

  const handleWidthChange = (e) => {
    const newWidth = parseInt(e.target.value, 10);
    setWidth(newWidth);
    _persistedWidth = newWidth;

    if (toolManager) {
      toolManager.updateOptions({ width: newWidth });
      // Update BOTH eraser instances so switching modes keeps the same radius
      const precisionInstance = toolManager.toolInstances?.get(TOOL_TYPES.ERASER);
      const objectInstance = toolManager.toolInstances?.get(TOOL_TYPES.OBJECT_ERASER);
      if (precisionInstance?.setOptions) precisionInstance.setOptions({ width: newWidth });
      if (objectInstance?.setOptions) objectInstance.setOptions({ width: newWidth });
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 w-auto">
      {/* Mode Toggle */}
      <div className="flex flex-col gap-1">
        {ERASER_MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => handleModeChange(m.id)}
            className={`p-2 rounded-lg transition-all duration-200 ${
              mode === m.id
                ? 'bg-primary/10 shadow-[inset_0_0_0_2px] shadow-primary'
                : 'hover:bg-muted/50'
            }`}
            title={m.description}
          >
            <m.icon
              className={`w-4 h-4 transition-colors ${
                mode === m.id ? 'text-primary' : 'text-muted-foreground'
              }`}
            />
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-border/50" />

      {/* Vertical Size Slider */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">
          Size
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {width}
        </span>
        <input
          type="range"
          min={WIDTH_MIN}
          max={WIDTH_MAX}
          value={width}
          onChange={handleWidthChange}
          style={{
            writingMode: 'vertical-lr',
            direction: 'rtl',
            height: '80px',
            width: '20px',
            cursor: 'pointer',
            accentColor: 'var(--primary)',
          }}
        />
      </div>
    </div>
  );
}
