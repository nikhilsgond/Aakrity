// src/components/canvas/tool-options/PencilOptions.jsx
import { useState, useEffect, useRef } from 'react';
import { PenLine, PenTool, Highlighter } from 'lucide-react';

const PRESETS = [
  {
    id: 'pen',
    icon: PenLine,
    options: {
      style: 'smooth',
      width: 2,
      opacity: 1.0,
      color: '#000000'
    },
    widthRange: { min: 1, max: 12 }
  },
  {
    id: 'marker',
    icon: PenTool,
    options: {
      style: 'smooth',
      width: 6,
      opacity: 0.9,
      color: '#3B82F6'
    },
    widthRange: { min: 4, max: 16 }
  },
  {
    id: 'highlighter',
    icon: Highlighter,
    options: {
      style: 'highlighter',
      width: 12,
      opacity: 0.3,
      highlighterColor: 'yellow',
      color: '#FFEB3B'
    },
    widthRange: { min: 8, max: 24 }
  }
];

const COLOR_PRESETS = {
  pen: ['#000000', '#3B82F6', '#EF4444', '#10B981', '#8B5CF6'],
  marker: ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6'],
  highlighter: ['#FFEB3B', '#4CAF50', '#FF4081']
};

const HIGHLIGHTER_COLORS = {
  '#FFEB3B': 'yellow',
  '#4CAF50': 'green',
  '#FF4081': 'pink'
};

export default function PencilOptions({ toolManager }) {
  const [selected, setSelected] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentWidth, setCurrentWidth] = useState(2);
  const [isEditingWidth, setIsEditingWidth] = useState(false);
  const widthInputRef = useRef(null);

  const currentPreset = PRESETS.find(p => p.id === selected);
  const { min, max } = currentPreset.widthRange;
  const isHighlighter = selected === 'highlighter';
  const colorOptions = COLOR_PRESETS[selected] || COLOR_PRESETS.pen;

  useEffect(() => {
    const preset = PRESETS.find(p => p.id === selected);
    if (preset) {
      setCurrentColor(preset.options.color);
      setCurrentWidth(preset.options.width);
    }
  }, [selected]);

  useEffect(() => {
    if (isEditingWidth && widthInputRef.current) {
      widthInputRef.current.focus();
      widthInputRef.current.select();
    }
  }, [isEditingWidth]);

  const handlePresetClick = (preset) => {
    if (!toolManager) return;

    setSelected(preset.id);
    setCurrentColor(preset.options.color);
    setCurrentWidth(preset.options.width);

    toolManager.updateOptions(preset.options);

    const instance = toolManager.toolInstances?.get('pencil');
    if (instance?.setOptions) {
      instance.setOptions(preset.options);
    }
  };

  const handleColorSelect = (newColor) => {
    if (!toolManager) return;

    setCurrentColor(newColor);

    if (isHighlighter) {
      const colorKey = HIGHLIGHTER_COLORS[newColor] || 'yellow';
      toolManager.updateOptions({
        color: newColor,
        highlighterColor: colorKey
      });
    } else {
      toolManager.updateOptions({ color: newColor });
    }

    const instance = toolManager.toolInstances?.get('pencil');
    if (instance?.setOptions) {
      instance.setOptions({ color: newColor });
    }
  };

  const handleWidthClick = () => {
    setIsEditingWidth(true);
  };

  const handleWidthChange = (e) => {
    const value = e.target.value;
    if (value === '') {
      setCurrentWidth('');
      return;
    }

    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      const clampedWidth = Math.max(min, Math.min(max, numValue));
      setCurrentWidth(clampedWidth);
    }
  };

  const handleWidthBlur = () => {
    setIsEditingWidth(false);

    if (!toolManager) return;

    const finalWidth = currentWidth === '' ? min : currentWidth;
    setCurrentWidth(finalWidth);

    toolManager.updateOptions({ width: finalWidth });

    const instance = toolManager.toolInstances?.get('pencil');
    if (instance?.setOptions) {
      instance.setOptions({ width: finalWidth });
    }
  };

  const handleWidthKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleWidthBlur();
    } else if (e.key === 'Escape') {
      setCurrentWidth(PRESETS.find(p => p.id === selected).options.width);
      setIsEditingWidth(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Presets */}
      <div className="flex flex-col gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePresetClick(preset)}
            className={`relative p-2 rounded-lg transition-all duration-200 ${selected === preset.id
              ? 'bg-primary/10 shadow-[inset_0_0_0_2px] shadow-primary'
              : 'hover:bg-muted/50'
              }  ${preset.id === 'marker' ? 'rotate-[270deg]' : ''}`}
            title={preset.id}
          >
            <preset.icon
              className={`w-4 h-4 mx-auto transition-colors ${selected === preset.id
                ? 'text-primary'
                : 'text-muted-foreground'
                }
                `}
            />
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-border/50" />

      {/* Color Swatches */}
      <div className="flex flex-col gap-2">
        <div className="text-[9px] font-medium text-muted-foreground text-center uppercase tracking-wide">
          Color
        </div>
        <div className="flex flex-col gap-2 items-center">
          {colorOptions.map((color) => (
            <button
              key={color}
              onClick={() => handleColorSelect(color)}
              className={`relative w-[20px] h-[20px] aspect-square rounded-full transition-all duration-200 ${currentColor === color
                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-10'
                : 'hover:scale-105 border border-border/50'
                }
              
            `}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Width Control */}
      <div className="flex flex-col gap-2">
        <div className="text-[9px] font-medium text-muted-foreground text-center uppercase tracking-wide">
          Width
        </div>
        {isEditingWidth ? (
          <input
            ref={widthInputRef}
            type="number"
            value={currentWidth}
            onChange={handleWidthChange}
            onBlur={handleWidthBlur}
            onKeyDown={handleWidthKeyDown}
            min={min}
            max={max}
            className="w-[32px] px-2 py-2 text-sm font-medium text-center rounded-lg border-2 border-primary bg-background focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        ) : (
          <button
            onClick={handleWidthClick}
            className="w-[32px] px-2 py-2 text-sm font-medium rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            {currentWidth}
          </button>
        )}
      </div>
    </div>
  );
}