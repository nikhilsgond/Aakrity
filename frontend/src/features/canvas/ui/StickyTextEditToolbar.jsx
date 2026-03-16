import { useState, useEffect } from 'react';
import { Bold, Italic, Check, ChevronDown } from 'lucide-react';
import ColorPickerPanel from './ColorPickerPanel';

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];

const STICKY_PRESET_COLORS = [
  '#FFF9C4', '#F8BBD0', '#BBDEFB', '#C8E6C9', '#FFE0B2', '#E1BEE7',
  '#FFCCBC', '#B2DFDB', '#D1C4E9', '#DCEDC8', '#FFE0CC', '#CFD8DC',
];

const normalizeColor = (color, fallback = '#000000') => {
  if (!color || typeof color !== 'string') return fallback;
  if (/^#[0-9A-F]{6}$/i.test(color)) return color;
  return fallback;
};

export default function StickyTextEditToolbar({ canvasManager, objectId, position, onDone }) {
  const [opts, setOpts] = useState({
    fontSize: 14,
    textColor: '#111111',
    noteColor: '#FFF176',
  });
  const [openColorPicker, setOpenColorPicker] = useState(null);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);

  useEffect(() => {
    if (!canvasManager || !objectId) return;
    const obj = canvasManager.getObjectById(objectId);
    if (!obj) return;
    setOpts({
      fontSize: obj.fontSize || 14,
      textColor: obj.textColor || '#111111',
      noteColor: obj.noteColor || '#FFF176',
    });
  }, [canvasManager, objectId]);

  const absorbMouse = (e) => e.preventDefault();

  const applyProp = (prop, value) => {
    setOpts(prev => ({ ...prev, [prop]: value }));
    const obj = canvasManager?.getObjectById?.(objectId);
    if (!obj) return;
    obj[prop] = value;
    obj.updatedAt = Date.now();
    canvasManager.requestRender();
    canvasManager.emit('sticky:textedit:stylechanged', { objectId });
    canvasManager.emit('object:modified', { target: obj });
  };

  const applyExecCommand = (command) => {
    const editor = document.querySelector(`[data-sticky-editor="${objectId}"]`);
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, null);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const toolbarStyle = (() => {
    if (!position) return { display: 'none' };
    return {
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y}px`,
      transform: 'translateX(-50%)',
      zIndex: 1100,
      maxWidth: 'calc(100vw - 20px)',
    };
  })();

  return (
    <div
      data-floating-toolbar
      style={toolbarStyle}
      onMouseDown={absorbMouse}
      className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-md shadow-lg px-3 py-2 flex items-center gap-2 flex-nowrap"
    >
      <div className="relative flex-shrink-0">
        <button
          onMouseDown={absorbMouse}
          onClick={() => { setShowSizeDropdown(v => !v); setOpenColorPicker(null); }}
          className="px-2 py-1 text-xs rounded border border-border bg-background text-foreground flex items-center gap-1 w-14"
        >
          <span className="flex-1 text-center">{opts.fontSize}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        </button>
        {showSizeDropdown && (
          <div className="absolute top-full left-0 mt-1 w-14 max-h-48 overflow-y-auto bg-card border border-border rounded-lg shadow-lg z-20">
            {FONT_SIZES.map(s => (
              <button
                key={s}
                onMouseDown={absorbMouse}
                onClick={() => { applyProp('fontSize', s); setShowSizeDropdown(false); }}
                className={`w-full px-2 py-1 text-xs text-center hover:bg-muted ${opts.fontSize === s ? 'text-blue-600 font-semibold' : 'text-foreground'}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onMouseDown={absorbMouse}
        onClick={() => applyExecCommand('bold')}
        title="Bold"
        className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-muted flex-shrink-0"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        onMouseDown={absorbMouse}
        onClick={() => applyExecCommand('italic')}
        title="Italic"
        className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-muted flex-shrink-0"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>

      <div className="relative flex-shrink-0">
        <button
          onMouseDown={absorbMouse}
          onClick={() => { setOpenColorPicker(openColorPicker === 'text' ? null : 'text'); setShowSizeDropdown(false); }}
          title="Text color"
          className="w-7 h-7 rounded border border-border flex flex-col items-center justify-center gap-0.5 hover:bg-muted"
        >
          <span className="text-[10px] font-bold leading-none" style={{ color: normalizeColor(opts.textColor, '#111111') }}>A</span>
          <span className="w-4 h-1 rounded-sm" style={{ backgroundColor: normalizeColor(opts.textColor, '#111111') }} />
        </button>
        {openColorPicker === 'text' && (
          <ColorPickerPanel
            value={normalizeColor(opts.textColor, '#111111')}
            onChange={(c) => applyProp('textColor', c)}
            type="stroke"
            onClose={() => setOpenColorPicker(null)}
          />
        )}
      </div>

      <div className="relative flex-shrink-0">
        <button
          onMouseDown={absorbMouse}
          onClick={() => { setOpenColorPicker(openColorPicker === 'note' ? null : 'note'); setShowSizeDropdown(false); }}
          className="w-8 h-8 rounded-full border border-border"
          style={{ backgroundColor: normalizeColor(opts.noteColor, '#FFF176') }}
          title="Note color"
        />
        {openColorPicker === 'note' && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-card border border-border rounded-lg shadow-lg z-20 grid grid-cols-6 gap-1.5 w-[156px]">
            {STICKY_PRESET_COLORS.map(c => (
              <button
                key={c}
                onMouseDown={absorbMouse}
                onClick={() => { applyProp('noteColor', c); setOpenColorPicker(null); }}
                className={`w-5 h-5 rounded-full border ${opts.noteColor === c ? 'border-blue-500 ring-2 ring-blue-300' : 'border-black/15'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 flex-shrink-0" />

      <button
        onMouseDown={absorbMouse}
        onClick={onDone}
        title="Done editing"
        className="px-2.5 py-1 text-xs rounded bg-blue-500 hover:bg-blue-600 text-white font-medium flex-shrink-0"
      >
        Done
      </button>
    </div>
  );
}