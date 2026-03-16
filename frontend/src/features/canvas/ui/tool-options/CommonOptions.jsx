// src/components/canvas/tool-options/CommonOptions.jsx
import { TOOL_OPTIONS } from "@shared/constants";
import { Minus, Plus } from 'lucide-react';

//  Remove useToolManager import - we'll pass props directly

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

//  Helper function to safely call ToolManager methods
const safeSetOption = (toolManager, key, value) => {
  if (!toolManager) return;
  
  if (typeof toolManager.setOption === 'function') {
    toolManager.setOption(key, value);
  } else if (typeof toolManager.updateOptions === 'function') {
    toolManager.updateOptions({ [key]: value });
  }
};

//  Get options safely from toolManager
const getOptions = (toolManager) => {
  if (!toolManager) return {};
  
  if (typeof toolManager.getActiveToolOptions === 'function') {
    return toolManager.getActiveToolOptions() || {};
  } else if (typeof toolManager.getOptions === 'function') {
    return toolManager.getOptions() || {};
  }
  
  return {};
};

//  Props-based components (no hook usage)
export function ColorPicker({ toolManager }) {
  const options = getOptions(toolManager);

  const handleColorChange = (color) => {
    safeSetOption(toolManager, TOOL_OPTIONS.COLOR, color);
  };

  return (
    <div className="flex flex-col items-center mb-3">
      <label className="text-xs mb-1 text-muted-foreground">Stroke Color</label>
      <input
        type="color"
        value={options[TOOL_OPTIONS.COLOR] || "#000000"}
        onChange={(e) => handleColorChange(e.target.value)}
        className="w-8 h-8 rounded border border-border cursor-pointer bg-background"
        title="Stroke color"
      />
    </div>
  );
}

export function WidthControl({ toolManager }) {
  const options = getOptions(toolManager);

  const handleWidthChange = (delta) => {
    const currentWidth = options[TOOL_OPTIONS.WIDTH] || 2;
    const newWidth = clamp(currentWidth + delta, 1, 30);
    safeSetOption(toolManager, TOOL_OPTIONS.WIDTH, newWidth);
  };

  return (
    <div className="flex flex-col items-center mb-3">
      <label className="text-xs mb-1 text-muted-foreground">Stroke Width</label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleWidthChange(-1)}
          className="w-6 h-6 rounded flex items-center justify-center bg-card border border-border text-foreground hover:bg-muted"
          disabled={!toolManager}
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="text-sm min-w-[2ch] text-center font-medium">
          {options[TOOL_OPTIONS.WIDTH] || 2}px
        </span>
        <button
          onClick={() => handleWidthChange(1)}
          className="w-6 h-6 rounded flex items-center justify-center bg-card border border-border text-foreground hover:bg-muted"
          disabled={!toolManager}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export function OpacitySlider({ toolManager }) {
  const options = getOptions(toolManager);

  const handleOpacityChange = (value) => {
    const opacity = parseFloat(value);
    safeSetOption(toolManager, TOOL_OPTIONS.OPACITY, opacity);
  };

  return (
    <div className="flex flex-col items-center mb-3">
      <label className="text-xs mb-1 text-muted-foreground">
        Opacity: {(options[TOOL_OPTIONS.OPACITY] || 1) * 100}%
      </label>
      <input
        type="range"
        min={0.05}
        max={1}
        step={0.05}
        value={options[TOOL_OPTIONS.OPACITY] || 1}
        onChange={(e) => handleOpacityChange(e.target.value)}
        className="w-full h-2 bg-card rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
        disabled={!toolManager}
      />
    </div>
  );
}

//  Main CommonOptions component
export default function CommonOptions({ toolManager, activeTool }) {
  if (!toolManager) {
    console.log("CommonOptions: No toolManager provided");
    return null;
  }

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <ColorPicker toolManager={toolManager} />
      <WidthControl toolManager={toolManager} />
      <OpacitySlider toolManager={toolManager} />
    </div>
  );
}