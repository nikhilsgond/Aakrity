import { useState, useEffect } from 'react';
import {
  AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Underline, Strikethrough,
  ChevronDown, Check, List, ListOrdered,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
} from 'lucide-react';
import ColorPickerPanel from './ColorPickerPanel';

const FONTS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Courier New, monospace', label: 'Courier New' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet' },
  { value: 'Impact, fantasy', label: 'Impact' },
];

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];

const normalizeColor = (color, fallback = '#000000') => {
  if (!color || typeof color !== 'string') return fallback;
  if (/^#[0-9A-F]{6}$/i.test(color)) return color;
  return fallback;
};

export default function ShapeTextEditToolbar({ canvasManager, objectId, position, onDone }) {
  const [opts, setOpts] = useState({
    fontFamily: 'Arial, sans-serif',
    innerTextSize: 14,
    innerTextWeight: 'normal',
    innerTextStyle: 'normal',
    innerTextUnderline: false,
    innerTextStrikethrough: false,
    innerTextAlign: 'center',
    innerTextVerticalAlign: 'middle',
    innerTextColor: '#111827',
    innerTextListType: 'none',
  });
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [openColorPicker, setOpenColorPicker] = useState(null);
  const [openTextPanel, setOpenTextPanel] = useState(null);

  // Sync from the live object
  useEffect(() => {
    if (!canvasManager || !objectId) return;
    const obj = canvasManager.getObjectById(objectId);
    if (!obj) return;
    setOpts({
      fontFamily: obj.fontFamily || 'Arial, sans-serif',
      innerTextSize: obj.innerTextSize || 14,
      innerTextWeight: obj.innerTextWeight || 'normal',
      innerTextStyle: obj.innerTextStyle || 'normal',
      innerTextUnderline: obj.innerTextUnderline || false,
      innerTextStrikethrough: obj.innerTextStrikethrough || false,
      innerTextAlign: obj.innerTextAlign || 'center',
      innerTextVerticalAlign: obj.innerTextVerticalAlign || 'middle',
      innerTextColor: obj.innerTextColor || '#111827',
      innerTextListType: obj.innerTextListType || 'none',
    });
  }, [canvasManager, objectId]);

  const applyProp = (prop, value) => {
    setOpts(prev => ({ ...prev, [prop]: value }));
    if (!canvasManager || !objectId) return;
    const obj = canvasManager.getObjectById(objectId);
    if (!obj) return;
    obj[prop] = value;
    obj.updatedAt = Date.now();
    canvasManager.requestRender();
    canvasManager.emit('object:modified', { target: obj });
    canvasManager.emit('shape:textedit:stylechanged', { objectId, showCanvasPreview: false });
  };

  // Prevent mousedown from blurring the textarea
  const absorbMouse = (e) => e.preventDefault();

  const toolbarStyle = (() => {
    if (!position) return { display: 'none' };
    const vw = window.innerWidth;
    const toolbarWidth = 600;
    let x = Math.max(toolbarWidth / 2 + 10, Math.min(position.x, vw - toolbarWidth / 2 - 10));
    let y = Math.max(10, position.y);
    return {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      transform: 'translateX(-50%)',
      zIndex: 1100,
    };
  })();

  const fontLabel = FONTS.find(f => f.value === opts.fontFamily)?.label ?? 'Arial';

  const decorationItems = [
    { prop: 'innerTextWeight', active: opts.innerTextWeight === 'bold', next: opts.innerTextWeight === 'bold' ? 'normal' : 'bold', title: 'Bold', Icon: Bold },
    { prop: 'innerTextStyle', active: opts.innerTextStyle === 'italic', next: opts.innerTextStyle === 'italic' ? 'normal' : 'italic', title: 'Italic', Icon: Italic },
    { prop: 'innerTextUnderline', active: !!opts.innerTextUnderline, next: !opts.innerTextUnderline, title: 'Underline', Icon: Underline },
    { prop: 'innerTextStrikethrough', active: !!opts.innerTextStrikethrough, next: !opts.innerTextStrikethrough, title: 'Strikethrough', Icon: Strikethrough },
  ];

  const alignmentItems = [
    { val: 'left', icon: AlignLeft, label: 'Align Left' },
    { val: 'center', icon: AlignCenter, label: 'Align Center' },
    { val: 'right', icon: AlignRight, label: 'Align Right' },
  ];

  const verticalItems = [
    { val: 'top', icon: AlignVerticalJustifyStart, label: 'Text Top' },
    { val: 'middle', icon: AlignVerticalJustifyCenter, label: 'Text Middle' },
    { val: 'bottom', icon: AlignVerticalJustifyEnd, label: 'Text Bottom' },
  ];

  const listItems = [
    { val: 'unordered', icon: List, label: 'Bulleted list' },
    { val: 'ordered', icon: ListOrdered, label: 'Numbered list' },
  ];

  const togglePanel = (panel) => {
    setShowFontDropdown(false);
    setShowSizeDropdown(false);
    setOpenColorPicker(null);
    setOpenTextPanel((current) => current === panel ? null : panel);
  };

  return (
    <div
      data-floating-toolbar
      style={toolbarStyle}
      onMouseDown={absorbMouse}
      className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-md shadow-lg px-3 py-2 flex items-center gap-2 flex-nowrap select-none max-w-[calc(100vw-20px)]"
    >
      {/* Font family */}
      <div className="relative flex-shrink-0">
        <button
          onMouseDown={absorbMouse}
          onClick={() => { setShowFontDropdown(v => !v); setShowSizeDropdown(false); setOpenColorPicker(null); setOpenTextPanel(null); }}
          className="px-2 py-1 text-xs rounded border border-border bg-background text-foreground flex items-center gap-1 min-w-[96px]"
        >
          <span className="flex-1 text-left truncate">{fontLabel}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        </button>
        {showFontDropdown && (
          <div className="absolute top-full left-0 mt-1 w-44 max-h-60 overflow-y-auto bg-card border border-border rounded-lg shadow-lg z-20">
            {FONTS.map(f => (
              <button
                key={f.value}
                onMouseDown={absorbMouse}
                onClick={() => { applyProp('fontFamily', f.value); setShowFontDropdown(false); }}
                className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-muted ${
                  opts.fontFamily === f.value ? 'text-blue-600 font-semibold' : 'text-foreground'
                }`}
              >
                <span style={{ fontFamily: f.value }}>{f.label}</span>
                {opts.fontFamily === f.value && <Check className="w-3 h-3" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Font size */}
      <div className="relative flex-shrink-0">
        <button
          onMouseDown={absorbMouse}
          onClick={() => { setShowSizeDropdown(v => !v); setShowFontDropdown(false); setOpenColorPicker(null); setOpenTextPanel(null); }}
          className="px-2 py-1 text-xs rounded border border-border bg-background text-foreground flex items-center gap-1 w-16"
        >
          <span className="flex-1 text-center">{opts.innerTextSize}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        </button>
        {showSizeDropdown && (
          <div className="absolute top-full left-0 mt-1 w-16 max-h-48 overflow-y-auto bg-card border border-border rounded-lg shadow-lg z-20">
            {FONT_SIZES.map(s => (
              <button
                key={s}
                onMouseDown={absorbMouse}
                onClick={() => { applyProp('innerTextSize', s); setShowSizeDropdown(false); }}
                className={`w-full px-2 py-1 text-xs text-center hover:bg-muted ${
                  opts.innerTextSize === s ? 'text-blue-600 font-semibold' : 'text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative flex-shrink-0">
        <button
          onMouseDown={absorbMouse}
          onClick={() => togglePanel('decoration')}
          title="Text decorations"
          className={`px-2 py-1 text-xs rounded border border-border bg-background text-foreground flex items-center gap-1 ${openTextPanel === 'decoration' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : ''}`}
        >
          <Bold className="w-3.5 h-3.5" />
          <ChevronDown className="w-3 h-3" />
        </button>
        {openTextPanel === 'decoration' && (
          <div className="absolute top-full left-0 mt-1 p-1 bg-card border border-border rounded-lg shadow-lg z-20 flex items-center gap-1">
            {decorationItems.map(({ prop, active, next, title, Icon }) => (
              <button
                key={prop}
                onMouseDown={absorbMouse}
                onClick={() => applyProp(prop, next)}
                title={title}
                className={`w-7 h-7 rounded border border-border flex items-center justify-center flex-shrink-0 ${active ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'hover:bg-muted'}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative flex-shrink-0">
        <button
          onMouseDown={absorbMouse}
          onClick={() => togglePanel('alignment')}
          title="Alignment"
          className={`px-2 py-1 text-xs rounded border border-border bg-background text-foreground flex items-center gap-1 ${openTextPanel === 'alignment' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : ''}`}
        >
          <AlignLeft className="w-3.5 h-3.5" />
          <ChevronDown className="w-3 h-3" />
        </button>
        {openTextPanel === 'alignment' && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-card border border-border rounded-lg shadow-lg z-20 min-w-[184px] space-y-2">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Horizontal</div>
              <div className="flex items-center gap-1">
                {alignmentItems.map(({ val, icon: Icon, label }) => (
                  <button
                    key={val}
                    onMouseDown={absorbMouse}
                    onClick={() => applyProp('innerTextAlign', val)}
                    title={label}
                    className={`w-7 h-7 rounded border border-border flex items-center justify-center flex-shrink-0 ${opts.innerTextAlign === val ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'hover:bg-muted'}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Vertical</div>
              <div className="flex items-center gap-1">
                {verticalItems.map(({ val, icon: Icon, label }) => (
                  <button
                    key={val}
                    onMouseDown={absorbMouse}
                    onClick={() => applyProp('innerTextVerticalAlign', val)}
                    title={label}
                    className={`w-7 h-7 rounded border border-border flex items-center justify-center flex-shrink-0 ${opts.innerTextVerticalAlign === val ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'hover:bg-muted'}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="relative flex-shrink-0">
        <button
          onMouseDown={absorbMouse}
          onClick={() => togglePanel('list')}
          title="Lists"
          className={`px-2 py-1 text-xs rounded border border-border bg-background text-foreground flex items-center gap-1 ${openTextPanel === 'list' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : ''}`}
        >
          <List className="w-3.5 h-3.5" />
          <ChevronDown className="w-3 h-3" />
        </button>
        {openTextPanel === 'list' && (
          <div className="absolute top-full left-0 mt-1 p-1 bg-card border border-border rounded-lg shadow-lg z-20 flex items-center gap-1">
            {listItems.map(({ val, icon: Icon, label }) => (
              <button
                key={val}
                onMouseDown={absorbMouse}
                onClick={() => applyProp('innerTextListType', opts.innerTextListType === val ? 'none' : val)}
                title={label}
                className={`w-7 h-7 rounded border border-border flex items-center justify-center flex-shrink-0 ${opts.innerTextListType === val ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'hover:bg-muted'}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 flex-shrink-0" />

      {/* Text color */}
      <div className="relative flex-shrink-0">
        <button
          onMouseDown={absorbMouse}
          onClick={() => { setOpenColorPicker(v => v === 'text' ? null : 'text'); setShowFontDropdown(false); setShowSizeDropdown(false); }}
          title="Text color"
          className="w-7 h-7 rounded border border-border flex flex-col items-center justify-center gap-0.5 hover:bg-muted"
        >
          <span className="text-[10px] font-bold leading-none" style={{ color: normalizeColor(opts.innerTextColor, '#111827') }}>A</span>
          <span className="w-4 h-1 rounded-sm" style={{ backgroundColor: normalizeColor(opts.innerTextColor, '#111827') }} />
        </button>
        {openColorPicker === 'text' && (
          <ColorPickerPanel
            value={normalizeColor(opts.innerTextColor, '#111827')}
            onChange={(c) => applyProp('innerTextColor', c)}
            type="stroke"
            onClose={() => setOpenColorPicker(null)}
          />
        )}
      </div>

      {/* Done button */}
      <button
        onMouseDown={absorbMouse}
        onClick={onDone}
        title="Done editing (Ctrl+Enter)"
        className="px-2.5 py-1 text-xs rounded bg-blue-500 hover:bg-blue-600 text-white font-medium flex-shrink-0"
      >
        Done
      </button>
    </div>
  );
}
