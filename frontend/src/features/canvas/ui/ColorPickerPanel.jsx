// src/components/canvas/ColorPickerPanel.jsx — Enhanced with hex input, opacity slider & recent colors
import { useState, useEffect, useRef, useCallback } from 'react';
import { Palette, Check } from 'lucide-react';

const RECENT_COLORS_KEY = 'collabdraw_recent_colors';
const MAX_RECENT = 8;

/** Persist recent colours in localStorage */
function loadRecentColors() {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecentColor(color) {
  if (!color || color === 'transparent') return;
  try {
    let recent = loadRecentColors();
    recent = [color, ...recent.filter(c => c !== color)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(recent));
  } catch { /* noop */ }
}

/** Validate hex string */
function isValidHex(str) {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(str);
}

/** Expand shorthand hex: #abc → #aabbcc */
function expandHex(hex) {
  if (!hex) return hex;
  if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

export default function ColorPickerPanel({
  value,
  onChange,
  type = 'stroke', // 'stroke' | 'fill' | 'text' | 'background'
  onClose,
  position = 'bottom',
  showOpacity = false,
  opacity = 1,
  onOpacityChange,
  showTransparent = false,
}) {
  const panelRef = useRef(null);

  // Combined modern palette
  const palette = [
    ...(showTransparent ? ['transparent'] : []),
    '#000000', '#333333', '#666666', '#999999', '#FFFFFF',
    '#FF595E', '#FF9F1C', '#FFCA3A', '#8AC926', '#4ECDC4',
    '#1982C4', '#6A4C93', '#0077B6', '#00B4D8', '#B5838D',
    '#F1948A',
  ];

  const [hexInput, setHexInput] = useState(() =>
    value === 'transparent' ? '' : (value || '#000000')
  );
  const [recentColors, setRecentColors] = useState(loadRecentColors);

  // Sync hex input when external value changes
  useEffect(() => {
    if (value && value !== 'transparent') setHexInput(value);
  }, [value]);

  // Click-outside close
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const selectColor = useCallback((color) => {
    saveRecentColor(color);
    setRecentColors(loadRecentColors());
    onChange(color);
    onClose();
  }, [onChange, onClose]);

  const handleHexSubmit = (e) => {
    e.preventDefault();
    let hex = hexInput.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    hex = expandHex(hex);
    if (isValidHex(hex)) {
      selectColor(hex.toUpperCase());
    }
  };

  const handleNativeColor = (e) => {
    const color = e.target.value;
    setHexInput(color);
    selectColor(color.toUpperCase());
  };

  const label = {
    stroke: 'Stroke Color',
    fill: 'Fill Color',
    text: 'Text Color',
    background: 'Background Color',
  }[type] || 'Color';

  return (
    <div
      ref={panelRef}
      className={`absolute ${position === 'bottom' ? 'top-full' : 'bottom-full'} left-0 mt-1 mb-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 z-20 min-w-[200px]`}
    >
      {/* Header */}
      <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</h3>

      {/* Preset Grid */}
      <div className="grid grid-cols-6 gap-1.5 mb-3">
        {palette.map((color, i) => (
          <button
            key={i}
            onClick={() => selectColor(color)}
            className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
              value === color ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 dark:border-gray-600'
            }`}
            style={{
              backgroundColor: color === 'transparent' ? 'transparent' : color,
              backgroundImage: color === 'transparent'
                ? 'linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%), linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%)'
                : 'none',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 4px 4px',
            }}
            title={color === 'transparent' ? 'Transparent' : color}
          >
            {value === color && (
              <Check className="w-3.5 h-3.5 m-auto text-white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }} />
            )}
          </button>
        ))}
      </div>

      {/* Recent Colors */}
      {recentColors.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 block">Recent</span>
          <div className="flex gap-1.5 flex-wrap">
            {recentColors.map((c, i) => (
              <button
                key={i}
                onClick={() => selectColor(c)}
                className={`w-6 h-6 rounded-full border ${value === c ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-300 dark:border-gray-600'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      {/* Hex Input */}
      <form onSubmit={handleHexSubmit} className="flex gap-1 mb-2">
        <input
          type="text"
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          placeholder="#000000"
          maxLength={7}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          type="submit"
          className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
        >
          Apply
        </button>
      </form>

      {/* Native color picker toggle */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 cursor-pointer text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
          <Palette className="w-3.5 h-3.5" />
          Custom
          <input
            type="color"
            value={value === 'transparent' ? '#ffffff' : (value || '#000000')}
            onChange={handleNativeColor}
            className="w-0 h-0 opacity-0 absolute"
          />
        </label>
      </div>

      {/* Opacity Slider (optional) */}
      {showOpacity && (
        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">Opacity</span>
            <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">{Math.round((opacity ?? 1) * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity ?? 1}
            onChange={(e) => onOpacityChange?.(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
          />
        </div>
      )}
    </div>
  );
}