import { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, BringToFront, SendToBack, Pencil, Smile, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, ChevronDown, Check, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, Trash2 } from 'lucide-react';
import { UpdateStyleCommand } from '../engine/commands/UpdateStyleCommand';
import { LayerOrderCommand } from '../engine/commands/LayerOrderCommand';
import { CreateObjectsCommand } from '../engine/commands/ObjectCommands';
import { generateId } from '@shared/lib/idGenerator';
import useCollaborationStore from '@features/room/state/collaborationStore';
import ColorPickerPanel from './ColorPickerPanel';

const TEXT_FONTS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Courier New, monospace', label: 'Courier New' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet' },
  { value: 'Impact, fantasy', label: 'Impact' },
];

const TEXT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];

const STICKY_PRESET_COLORS = [
  '#FFF9C4', '#F8BBD0', '#BBDEFB', '#C8E6C9', '#FFE0B2', '#E1BEE7',
  '#FFCCBC', '#B2DFDB', '#D1C4E9', '#DCEDC8', '#FFE0CC', '#CFD8DC',
];

const normalizeColor = (color, fallback = '#000000') => {
  if (!color) return fallback;
  if (typeof color !== 'string') return fallback;
  if (/^#[0-9A-F]{6}$/i.test(color)) return color;
  return fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function ContextToolbar({
  canvasManager,
  selectedIds = [],
  selectedObjects = [],
  position,
  showToolbar,
  onStartShapeEdit,
  onDeleteSelected,
}) {
  const [localProps, setLocalProps] = useState({});
  const [openColorPicker, setOpenColorPicker] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [openTextPanel, setOpenTextPanel] = useState(null);
  const toolbarRef = useRef(null);

  const selectedObject = selectedObjects.length === 1 ? selectedObjects[0] : null;


  const closeTransientMenus = () => {
    setOpenColorPicker(null);
    setShowFontDropdown(false);
    setShowSizeDropdown(false);
    setOpenTextPanel(null);
  };
  // Get selection context from CanvasManager
  const getSelectionContext = useCallback(() => {
    if (!canvasManager) return null;
    return canvasManager.getSelectionContext();
  }, [canvasManager]);

  // Mount animation
  useEffect(() => {
    if (showToolbar && position) {
      setMounted(false);
      const t = setTimeout(() => setMounted(true), 12);
      return () => clearTimeout(t);
    }
  }, [showToolbar, position, selectedObject?.id]);

  // Update local props when selection changes
  useEffect(() => {
    if (selectedIds.length > 0) {
      const context = getSelectionContext();
      if (context) {
        setLocalProps(context.commonProps);
      }
    } else {
      closeTransientMenus();
    }
  }, [selectedIds, getSelectionContext]);

  useEffect(() => {
    closeTransientMenus();
  }, [selectedObject?.id]);

  if (!showToolbar || !position || selectedIds.length === 0) {
    return null;
  }

  const context = getSelectionContext();
  if (!context) return null;

  const { type, count, objects, commonProps, types } = context;
  const getPropValue = (prop, fallback) => {
    if (localProps[prop] !== undefined) return localProps[prop];
    if (commonProps[prop] !== undefined) return commonProps[prop];
    if (selectedObject?.[prop] !== undefined) return selectedObject[prop];
    return fallback;
  };

  const updateProperty = (prop, value) => {
    setLocalProps(prev => ({ ...prev, [prop]: value }));

    // If TextTool is actively editing this text, route through it for live sync
    const activeTool = canvasManager.getActiveTool?.();
    if (activeTool?.name === 'text' && activeTool.isEditing && activeTool.editingTextId) {
      activeTool.updateTextProperty(prop, value);
      return;
    }

    const ids = objects.map(obj => obj.id);
    const cmd = new UpdateStyleCommand(ids, { [prop]: value });
    canvasManager.executeCommand(cmd);
  };

  const toggleTextPanel = (panel) => {
    setShowFontDropdown(false);
    setShowSizeDropdown(false);
    setOpenColorPicker(null);
    setOpenTextPanel(current => current === panel ? null : panel);
  };

  const bringToFront = () => {
    const ids = objects.map(obj => obj.id);
    const cmd = new LayerOrderCommand(ids, 'front');
    canvasManager.executeCommand(cmd);
  };

  const sendToBack = () => {
    const ids = objects.map(obj => obj.id);
    const cmd = new LayerOrderCommand(ids, 'back');
    canvasManager.executeCommand(cmd);
  };

  const duplicateObjects = () => {
    const currentUserId = useCollaborationStore.getState().currentUser?.id || null;
    const copies = objects.map(obj => {
      const src = canvasManager.getObjectById(obj.id) || obj;
      const cloned = JSON.parse(JSON.stringify(src));
      delete cloned.imageElement;
      delete cloned.isPreview;
      delete cloned.isRemotePreview;
      delete cloned.userId;
      cloned.id = generateId();
      cloned.createdAt = Date.now();
      cloned.updatedAt = Date.now();
      cloned.creationSource = 'duplicate';
      if (currentUserId) {
        cloned.lastEditedBy = currentUserId;
        cloned.lastEditedAt = Date.now();
      }

      if (cloned.x !== undefined) cloned.x += 20;
      if (cloned.y !== undefined) cloned.y += 20;
      if (cloned.x1 !== undefined) cloned.x1 += 20;
      if (cloned.y1 !== undefined) cloned.y1 += 20;
      if (cloned.x2 !== undefined) cloned.x2 += 20;
      if (cloned.y2 !== undefined) cloned.y2 += 20;
      if (Array.isArray(cloned.points)) {
        cloned.points = cloned.points.map(p => ({ ...p, x: p.x + 20, y: p.y + 20 }));
      }

      return cloned;
    });

    if (copies.length === 0) return;
    const cmd = new CreateObjectsCommand(copies);
    canvasManager.executeLocalCommand(cmd);
    canvasManager.setSelection(copies.map(o => o.id));
    canvasManager.requestRender();
  };

  const toolbarStyle = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: 'translateX(-50%)',
    zIndex: 1200,
    pointerEvents: 'auto',
    maxWidth: 'calc(100vw - 20px)',
  };

  // Opacity: show if in commonProps OR type is a known type that supports it (includes mixed)
  const OPACITY_TYPES = new Set(['rectangle', 'roundedRectangle', 'circle', 'ellipse', 'triangle', 'diamond', 'star', 'hexagon', 'pentagon', 'polygon', 'line', 'arrow', 'drawing', 'emoji', 'sticky', 'image', 'text']);
  const effectiveOpacity = localProps.opacity ?? commonProps.opacity ?? 1;
  const showOpacity = commonProps.opacity !== undefined
    || OPACITY_TYPES.has(type)
    || (type === 'mixed' && Array.isArray(types) && types.every(t => OPACITY_TYPES.has(t)));

  const textProps = type === 'text' ? { ...commonProps, ...localProps } : null;
  const fontLabel = TEXT_FONTS.find(f => f.value === (textProps?.fontFamily || commonProps.fontFamily))?.label ?? 'Arial';
  const showStandaloneOpacity = showOpacity
    && commonProps.strokeColor === undefined
    && commonProps.borderColor === undefined
    && type !== 'text'
    && type !== 'sticky';
  const textAutoWidth = getPropValue('autoWidth', true) !== false;
  const textAutoHeight = getPropValue('autoHeight', true) !== false;

  const textDecorationItems = [
    { prop: 'fontWeight', onVal: 'bold', offVal: 'normal', label: 'Bold', Icon: Bold },
    { prop: 'fontStyle', onVal: 'italic', offVal: 'normal', label: 'Italic', Icon: Italic },
    { prop: 'underline', onVal: true, offVal: false, label: 'Underline', Icon: Underline },
    { prop: 'strikethrough', onVal: true, offVal: false, label: 'Strikethrough', Icon: Strikethrough },
  ];

  const horizontalAlignmentItems = [
    { val: 'left', icon: AlignLeft, label: 'Align left' },
    { val: 'center', icon: AlignCenter, label: 'Align center' },
    { val: 'right', icon: AlignRight, label: 'Align right' },
  ];

  const verticalAlignmentItems = [
    { val: 'top', icon: AlignVerticalJustifyStart, label: 'Top' },
    { val: 'middle', icon: AlignVerticalJustifyCenter, label: 'Middle' },
    { val: 'bottom', icon: AlignVerticalJustifyEnd, label: 'Bottom' },
  ];

  const listItems = [
    { val: 'unordered', icon: List, label: 'Bullet list' },
    { val: 'ordered', icon: ListOrdered, label: 'Numbered list' },
  ];

  return (
    <div
      ref={toolbarRef}
      data-floating-toolbar
      style={toolbarStyle}
      onMouseDown={(e) => {
        // Prevent focus steal from contenteditable during text editing
        if (e.target.tagName !== 'INPUT') e.preventDefault();
      }}
      className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-md shadow-lg px-3 py-2 flex items-center gap-2 flex-nowrap transition-all duration-150 ease-out transform ${mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
    >
      {/* ── TEXT OBJECT CONTROLS ── */}
      {type === 'text' && (
        <>
          {/* Font family */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setShowFontDropdown(v => !v); setShowSizeDropdown(false); setOpenColorPicker(null); setOpenTextPanel(null); }}
              className="px-2 py-1 text-xs rounded border border-border bg-background text-foreground flex items-center gap-1 min-w-[90px]"
            >
              <span className="flex-1 text-left truncate">{fontLabel}</span>
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            </button>
            {showFontDropdown && (
              <div className="absolute top-full left-0 mt-1 w-44 max-h-60 overflow-y-auto bg-card border border-border rounded-lg shadow-lg z-20">
                {TEXT_FONTS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => { updateProperty('fontFamily', f.value); setShowFontDropdown(false); }}
                    className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-muted ${(textProps?.fontFamily || commonProps.fontFamily) === f.value ? 'text-blue-600 font-semibold' : 'text-foreground'}`}
                  >
                    <span style={{ fontFamily: f.value }}>{f.label}</span>
                    {(textProps?.fontFamily || commonProps.fontFamily) === f.value && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Font size */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setShowSizeDropdown(v => !v); setShowFontDropdown(false); setOpenColorPicker(null); setOpenTextPanel(null); }}
              className="px-2 py-1 text-xs rounded border border-border bg-background text-foreground flex items-center gap-1 w-14"
            >
              <span className="flex-1 text-center">{textProps?.fontSize || commonProps.fontSize || 16}</span>
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            </button>
            {showSizeDropdown && (
              <div className="absolute top-full left-0 mt-1 w-14 max-h-48 overflow-y-auto bg-card border border-border rounded-lg shadow-lg z-20">
                {TEXT_SIZES.map(s => (
                  <button
                    key={s}
                    onClick={() => { updateProperty('fontSize', s); setShowSizeDropdown(false); }}
                    className={`w-full px-2 py-1 text-xs text-center hover:bg-muted ${(textProps?.fontSize || commonProps.fontSize) === s ? 'text-blue-600 font-semibold' : 'text-foreground'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => updateProperty('autoWidth', !textAutoWidth)}
            title="Auto width"
            className={`px-2 py-1 text-[11px] rounded border border-border font-medium flex-shrink-0 ${textAutoWidth ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'bg-background text-foreground hover:bg-muted'}`}
          >
            AW
          </button>
          <button
            onClick={() => updateProperty('autoHeight', !textAutoHeight)}
            title="Auto height"
            className={`px-2 py-1 text-[11px] rounded border border-border font-medium flex-shrink-0 ${textAutoHeight ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'bg-background text-foreground hover:bg-muted'}`}
          >
            AH
          </button>
          <div className="relative flex-shrink-0">
            <button
              onClick={() => toggleTextPanel('decoration')}
              title="Text decorations"
              className={`px-2 py-1 text-xs rounded border border-border bg-background text-foreground flex items-center gap-1 ${openTextPanel === 'decoration' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : ''}`}
            >
              <Bold className="w-3.5 h-3.5" />
              <ChevronDown className="w-3 h-3" />
            </button>
            {openTextPanel === 'decoration' && (
              <div className="absolute top-full left-0 mt-1 p-1 bg-card border border-border rounded-lg shadow-lg z-20 flex items-center gap-1">
                {textDecorationItems.map(({ prop, onVal, offVal, label, Icon }) => {
                  const cur = textProps?.[prop] ?? commonProps[prop];
                  const isOn = typeof onVal === 'boolean' ? !!cur : cur === onVal;
                  return (
                    <button
                      key={prop}
                      onClick={() => updateProperty(prop, isOn ? offVal : onVal)}
                      title={label}
                      className={`w-7 h-7 rounded border border-border flex items-center justify-center flex-shrink-0 ${isOn ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'hover:bg-muted'}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="relative flex-shrink-0">
            <button
              onClick={() => toggleTextPanel('alignment')}
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
                    {horizontalAlignmentItems.map(({ val, icon: Icon, label }) => (
                      <button
                        key={val}
                        onClick={() => updateProperty('textAlign', val)}
                        title={label}
                        className={`w-7 h-7 rounded border border-border flex items-center justify-center flex-shrink-0 ${(textProps?.textAlign || commonProps.textAlign || 'left') === val ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'hover:bg-muted'}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Vertical</div>
                  <div className="flex items-center gap-1">
                    {verticalAlignmentItems.map(({ val, icon: Icon, label }) => (
                      <button
                        key={val}
                        onClick={() => updateProperty('verticalAlign', val)}
                        title={label}
                        className={`w-7 h-7 rounded border border-border flex items-center justify-center flex-shrink-0 ${(textProps?.verticalAlign || commonProps.verticalAlign || 'top') === val ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'hover:bg-muted'}`}
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
              onClick={() => toggleTextPanel('list')}
              title="Lists"
              className={`px-2 py-1 text-xs rounded border border-border bg-background text-foreground flex items-center gap-1 ${openTextPanel === 'list' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : ''}`}
            >
              <List className="w-3.5 h-3.5" />
              <ChevronDown className="w-3 h-3" />
            </button>
            {openTextPanel === 'list' && (
              <div className="absolute top-full left-0 mt-1 p-1 bg-card border border-border rounded-lg shadow-lg z-20 flex items-center gap-1">
                {listItems.map(({ val, icon: Icon, label }) => {
                  const cur = textProps?.listType || commonProps.listType || 'none';
                  return (
                    <button
                      key={val}
                      onClick={() => updateProperty('listType', cur === val ? 'none' : val)}
                      title={label}
                      className={`w-7 h-7 rounded border border-border flex items-center justify-center flex-shrink-0 ${cur === val ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'hover:bg-muted'}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Text color */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setOpenColorPicker(openColorPicker === 'textcolor' ? null : 'textcolor'); setOpenTextPanel(null); setShowFontDropdown(false); setShowSizeDropdown(false); }}
              title="Text color"
              className="w-7 h-7 rounded border border-border flex flex-col items-center justify-center gap-0.5 hover:bg-muted"
            >
              <span className="text-[10px] font-bold leading-none" style={{ color: normalizeColor(localProps.textColor || commonProps.textColor, '#111827') }}>A</span>
              <span className="w-4 h-1 rounded-sm" style={{ backgroundColor: normalizeColor(localProps.textColor || commonProps.textColor, '#111827') }} />
            </button>
            {openColorPicker === 'textcolor' && (
              <ColorPickerPanel
                value={normalizeColor(localProps.textColor || commonProps.textColor, '#111827')}
                onChange={(c) => updateProperty('textColor', c)}
                type="stroke"
                onClose={() => setOpenColorPicker(null)}
                showOpacity={showOpacity}
                opacity={effectiveOpacity}
                onOpacityChange={(v) => updateProperty('opacity', v)}
              />
            )}
          </div>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 flex-shrink-0" />
        </>
      )}

      {/* Stroke Color */}
      {(commonProps.strokeColor !== undefined) && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setOpenColorPicker('stroke')}
            className="w-8 h-8 rounded-full border border-border"
            style={{ backgroundColor: normalizeColor(localProps.strokeColor || commonProps.strokeColor, '#000000') }}
            title="Stroke color"
          />
          {openColorPicker === 'stroke' && (
            <ColorPickerPanel
              value={normalizeColor(localProps.strokeColor || commonProps.strokeColor, '#000000')}
              onChange={(c) => updateProperty('strokeColor', c)}
              type="stroke"
              onClose={() => setOpenColorPicker(null)}
              showOpacity={showOpacity}
              opacity={effectiveOpacity}
              onOpacityChange={(v) => updateProperty('opacity', v)}
            />
          )}
        </div>
      )}

      {/* Fill Color */}
      {(commonProps.fillColor !== undefined) && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setOpenColorPicker('fill')}
            className="w-8 h-8 rounded-full border border-border"
            style={{
              backgroundColor: normalizeColor(localProps.fillColor || commonProps.fillColor, '#ffffff'),
              backgroundImage: (localProps.fillColor || commonProps.fillColor) === 'transparent'
                ? 'linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%), linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%)'
                : 'none',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 4px 4px',
            }}
            title="Fill color"
          />
          {openColorPicker === 'fill' && (
            <ColorPickerPanel
              value={normalizeColor(localProps.fillColor || commonProps.fillColor, '#ffffff')}
              onChange={(c) => updateProperty('fillColor', c)}
              type="fill"
              onClose={() => setOpenColorPicker(null)}
              showTransparent
            />
          )}
        </div>
      )}

      {/* Background Color (text objects) */}
      {(commonProps.backgroundColor !== undefined) && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setOpenColorPicker('bg')}
            className="w-8 h-8 rounded-full border border-border"
            style={{ backgroundColor: normalizeColor(localProps.backgroundColor || commonProps.backgroundColor, '#ffffff') }}
            title="Background color"
          />
          {openColorPicker === 'bg' && (
            <ColorPickerPanel
              value={normalizeColor(localProps.backgroundColor || commonProps.backgroundColor, '#ffffff')}
              onChange={(c) => updateProperty('backgroundColor', c)}
              type="fill"
              onClose={() => setOpenColorPicker(null)}
            />
          )}
        </div>
      )}

      {(commonProps.borderColor !== undefined) && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setOpenColorPicker('border')}
            className="w-8 h-8 rounded-full border border-border"
            style={{ backgroundColor: normalizeColor(localProps.borderColor || commonProps.borderColor, '#000000') }}
            title="Border color"
          />
          {openColorPicker === 'border' && (
            <ColorPickerPanel
              value={normalizeColor(localProps.borderColor || commonProps.borderColor, '#000000')}
              onChange={(c) => updateProperty('borderColor', c)}
              type="stroke"
              onClose={() => setOpenColorPicker(null)}
              showOpacity={showOpacity}
              opacity={effectiveOpacity}
              onOpacityChange={(v) => updateProperty('opacity', v)}
            />
          )}
        </div>
      )}

      {/* Note Color (sticky notes) */}
      {(commonProps.noteColor !== undefined || type === 'sticky') && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setOpenColorPicker(openColorPicker === 'note' ? null : 'note')}
            className="w-8 h-8 rounded-full border border-border"
            style={{ backgroundColor: normalizeColor(getPropValue('noteColor', '#FFF9C4'), '#FFF9C4') }}
            title="Note color"
          />
          {openColorPicker === 'note' && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 p-2 bg-card border border-border rounded-lg shadow-lg z-20 w-[176px]">
              <div className="grid grid-cols-6 gap-1.5 mb-2">
                {STICKY_PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateProperty('noteColor', c)}
                    className={`w-5 h-5 rounded-full border ${normalizeColor(getPropValue('noteColor', '#FFF9C4'), '#FFF9C4') === c ? 'border-blue-500 ring-2 ring-blue-300' : 'border-black/15'}`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
              {type === 'sticky' && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Op</span>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={effectiveOpacity}
                    onChange={(e) => updateProperty('opacity', parseFloat(e.target.value))}
                    className="w-20 h-1.5 appearance-none cursor-pointer rounded bg-gray-200 dark:bg-gray-600 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                  />
                  <span className="text-[10px] w-7">{Math.round(effectiveOpacity * 100)}%</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stroke Width */}
      {(commonProps.strokeWidth !== undefined) && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => updateProperty('strokeWidth', clamp((localProps.strokeWidth || 2) - 1, 1, 30))}
            className="w-6 h-6 rounded flex items-center justify-center border border-border"
          >
            -
          </button>
          <span className="text-xs px-1 w-6 text-center">{localProps.strokeWidth || commonProps.strokeWidth || 2}</span>
          <button
            onClick={() => updateProperty('strokeWidth', clamp((localProps.strokeWidth || 2) + 1, 1, 30))}
            className="w-6 h-6 rounded flex items-center justify-center border border-border"
          >
            +
          </button>
        </div>
      )}

      {(commonProps.borderWidth !== undefined) && (
        <div className="flex items-center gap-1 flex-shrink-0" title="Border width (px)">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">B</span>
          <input
            type="number"
            min={0}
            max={50}
            value={localProps.borderWidth ?? commonProps.borderWidth ?? 0}
            onChange={(e) => {
              const v = Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 0));
              updateProperty('borderWidth', v);
            }}
            className="w-12 h-6 text-xs text-center rounded border border-border bg-background text-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      )}

      {/* Corner Radius — rectangle shapes only */}
      {((commonProps.cornerRadius !== undefined) || (type === 'rectangle' && count === 1)) && (
        <div className="flex items-center gap-1 flex-shrink-0" title="Corner radius (px)">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">R</span>
          <input
            type="number"
            min={0}
            max={200}
            value={getPropValue('cornerRadius', 0)}
            onChange={(e) => {
              const v = Math.max(0, Math.min(200, parseInt(e.target.value, 10) || 0));
              updateProperty('cornerRadius', v);
            }}
            className="w-12 h-6 text-xs text-center rounded border border-border bg-background text-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      )}

      {(commonProps.borderRadius !== undefined) && (
        <div className="flex items-center gap-1 flex-shrink-0" title="Border radius (px)">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">R</span>
          <input
            type="number"
            min={0}
            max={200}
            value={localProps.borderRadius ?? commonProps.borderRadius ?? 0}
            onChange={(e) => {
              const v = Math.max(0, Math.min(200, parseInt(e.target.value, 10) || 0));
              updateProperty('borderRadius', v);
            }}
            className="w-12 h-6 text-xs text-center rounded border border-border bg-background text-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      )}

      {/* Opacity (always show for supported types) */}
      {showStandaloneOpacity && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">Op</span>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={effectiveOpacity}
            onChange={(e) => updateProperty('opacity', parseFloat(e.target.value))}
            className="w-16 h-1.5 appearance-none cursor-pointer rounded bg-gray-200 dark:bg-gray-600 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
          />
          <span className="text-[10px] w-7">{Math.round(effectiveOpacity * 100)}%</span>
        </div>
      )}

      {/* Divider */}
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 flex-shrink-0" />

      {/* Swap emoji button — single emoji selection only */}
      {count === 1 && type === 'emoji' && (
        <button
          onClick={() => canvasManager.emit('emoji:swap', { objectId: selectedObjects[0]?.id })}
          title="Swap emoji"
          className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-400 transition-colors flex-shrink-0"
        >
          <Smile className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Edit text button — for single shape selection (all types including line/arrow) */}
      {count === 1 &&
        selectedObjects[0]?.type === 'shape' &&
        typeof onStartShapeEdit === 'function' && (
          <button
            onClick={() => onStartShapeEdit(selectedObjects[0].id)}
            title="Edit text inside shape"
            className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-400 hover:text-blue-600 transition-colors flex-shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}

      {count === 1 && type === 'sticky' && (
        <button
          onClick={() => canvasManager.emit('sticky:edit', { objectId: selectedObjects[0]?.id, point: null })}
          title="Edit sticky note"
          className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-400 hover:text-blue-600 transition-colors flex-shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Common actions */}
      {typeof onDeleteSelected === 'function' && count > 0 && (
        <button
          onClick={onDeleteSelected}
          title="Delete"
          className="w-7 h-7 rounded border border-border flex items-center justify-center flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      <button onClick={duplicateObjects} title="Duplicate" className="w-7 h-7 rounded border border-border flex items-center justify-center flex-shrink-0">
        <Copy className="w-3.5 h-3.5" />
      </button>
      <button onClick={bringToFront} title="Bring to Front" className="w-7 h-7 rounded border border-border flex items-center justify-center flex-shrink-0">
        <BringToFront className="w-3.5 h-3.5" />
      </button>
      <button onClick={sendToBack} title="Send to Back" className="w-7 h-7 rounded border border-border flex items-center justify-center flex-shrink-0">
        <SendToBack className="w-3.5 h-3.5" />
      </button>

      {/* Selection count */}
      {count > 1 && (
        <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full flex-shrink-0">
          {count} selected
        </span>
      )}
    </div>
  );
}