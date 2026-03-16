// src/components/canvas/FloatingTextToolbar.jsx
import { useState, useEffect, useRef } from 'react';
import {
    AlignLeft, AlignCenter, AlignRight,
    Bold, Italic, Underline, Strikethrough,
    ChevronDown, Type, List, ListOrdered, Minus,
    BringToFront, SendToBack
} from 'lucide-react';
import TextFormattingPanel from './TextFormattingPanel';
import TextAlignmentPanel from './TextAlignmentPanel';
import ListFormatPanel from './ListFormatPanel';
import ColorPickerPanel from './ColorPickerPanel';
import { LayerOrderCommand } from '../engine/commands/LayerOrderCommand';

export default function FloatingTextToolbar({ canvasManager, textObject, position, onFinish }) {
    const [options, setOptions] = useState({
        fontFamily: 'Arial, sans-serif',
        fontSize: 24,
        textColor: '#000000',
        backgroundColor: 'transparent',
        textAlign: 'left',
        fontWeight: 'normal',
        fontStyle: 'normal',
        underline: false,
        strikethrough: false,
        listType: 'none',
    });

    const [showFontDropdown, setShowFontDropdown] = useState(false);
    const [showSizeDropdown, setShowSizeDropdown] = useState(false);
    const [showFormattingPanel, setShowFormattingPanel] = useState(false);
    const [showAlignmentPanel, setShowAlignmentPanel] = useState(false);
    const [showListPanel, setShowListPanel] = useState(false);
    const [showTextColorPanel, setShowTextColorPanel] = useState(false);
    const [showBgColorPanel, setShowBgColorPanel] = useState(false);
    const toolbarRef = useRef(null);

    // Sync options from the live text object whenever it changes
    useEffect(() => {
        if (textObject) {
            setOptions({
                fontFamily: textObject.fontFamily || 'Arial, sans-serif',
                fontSize: textObject.fontSize || 24,
                textColor: textObject.textColor || '#000000',
                backgroundColor: textObject.backgroundColor || 'transparent',
                textAlign: textObject.textAlign || 'left',
                fontWeight: textObject.fontWeight || 'normal',
                fontStyle: textObject.fontStyle || 'normal',
                underline: textObject.underline || false,
                strikethrough: textObject.strikethrough || false,
                listType: textObject.listType || 'none',
            });
        }
    }, [textObject]);

    // ── KEY FIX: Apply property directly to the object in the scene graph,
    //    regardless of which tool is currently active.
    //    Then emit text:update so remote clients see it, and request a render.
    const updateOption = (property, value) => {
        setOptions(prev => ({ ...prev, [property]: value }));

        if (!canvasManager || !textObject) return;

        const obj = canvasManager.getObjectById(textObject.id);
        if (!obj) return;

        // Apply directly to the live object
        obj[property] = value;
        obj.updatedAt = Date.now();
        canvasManager.requestRender();

        // Also try to update via text tool if it's still active (live editing mode)
        const activeTool = canvasManager.getActiveTool();
        if (activeTool && activeTool.name === 'text' && activeTool.isEditing) {
            activeTool.updateTextProperty(property, value);
        }

        // Broadcast the formatting change to remote clients
        canvasManager.emit('text:update', {
            textId: textObject.id,
            text: obj.text,
            fontFamily: obj.fontFamily,
            fontSize: obj.fontSize,
            textColor: obj.textColor,
            textAlign: obj.textAlign,
            fontWeight: obj.fontWeight,
            fontStyle: obj.fontStyle,
            underline: obj.underline,
            strikethrough: obj.strikethrough,
            backgroundColor: obj.backgroundColor,
            listType: obj.listType,
            formattedRanges: obj.formattedRanges || [],
        });
    };

    const fonts = [
        { value: 'Arial, sans-serif', label: 'Arial' },
        { value: 'Times New Roman, serif', label: 'Times New Roman' },
        { value: 'Georgia, serif', label: 'Georgia' },
        { value: 'Courier New, monospace', label: 'Courier New' },
        { value: 'Verdana, sans-serif', label: 'Verdana' },
        { value: 'Helvetica, sans-serif', label: 'Helvetica' },
        { value: 'Comic Sans MS, cursive', label: 'Comic Sans' },
        { value: 'Impact, fantasy', label: 'Impact' },
    ];

    const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];

    const formattingOptions = [
        { id: 'bold', label: 'Bold', icon: Bold, property: 'fontWeight', value: 'bold', activeValue: 'bold', default: 'normal' },
        { id: 'italic', label: 'Italic', icon: Italic, property: 'fontStyle', value: 'italic', activeValue: 'italic', default: 'normal' },
        { id: 'underline', label: 'Underline', icon: Underline, property: 'underline', value: true, activeValue: true, default: false },
        { id: 'strikethrough', label: 'Strikethrough', icon: Strikethrough, property: 'strikethrough', value: true, activeValue: true, default: false },
    ];

    const alignmentOptions = [
        { value: 'left', icon: AlignLeft, label: 'Left Align' },
        { value: 'center', icon: AlignCenter, label: 'Center Align' },
        { value: 'right', icon: AlignRight, label: 'Right Align' },
    ];

    const listOptions = [
        { value: 'none', icon: Minus, label: 'None' },
        { value: 'unordered', icon: List, label: 'Bulleted List' },
        { value: 'ordered', icon: ListOrdered, label: 'Numbered List' },
    ];

    const getToolbarStyle = () => {
        if (!position) return { display: 'none' };

        const viewportWidth = window.innerWidth;
        const toolbarWidth = 600;
        let adjustedX = position.x;
        let adjustedY = position.y;

        if (adjustedX - toolbarWidth / 2 < 10) adjustedX = toolbarWidth / 2 + 10;
        else if (adjustedX + toolbarWidth / 2 > viewportWidth - 10) adjustedX = viewportWidth - toolbarWidth / 2 - 10;
        if (adjustedY < 10) adjustedY = 60;

        return {
            position: 'fixed',
            left: `${adjustedX}px`,
            top: `${adjustedY}px`,
            transform: 'translateX(-50%)',
            zIndex: 1000,
        };
    };

    const getCurrentFontLabel = () => {
        const font = fonts.find(f => f.value === options.fontFamily);
        return font ? font.label : 'Arial';
    };

    const isAnyFormattingActive = () =>
        formattingOptions.some(option => options[option.property] === option.activeValue);

    const closeAllPanels = () => {
        setShowFontDropdown(false);
        setShowSizeDropdown(false);
        setShowFormattingPanel(false);
        setShowAlignmentPanel(false);
        setShowListPanel(false);
        setShowTextColorPanel(false);
        setShowBgColorPanel(false);
    };

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
                closeAllPanels();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div
            ref={toolbarRef}
            data-floating-toolbar="text"
            style={getToolbarStyle()}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-2 flex items-center gap-1"
            // Prevent mousedown from bubbling to canvas (which would blur textarea)
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Font Family */}
            <div className="relative">
                <button
                    onClick={() => { setShowFontDropdown(!showFontDropdown); setShowSizeDropdown(false); setShowFormattingPanel(false); setShowAlignmentPanel(false); setShowListPanel(false); }}
                    className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1 min-w-[120px]"
                >
                    <span className="flex-1 text-left">{getCurrentFontLabel()}</span>
                    <ChevronDown className="w-3 h-3" />
                </button>
                {showFontDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-48 max-h-64 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20">
                        {fonts.map(font => (
                            <button key={font.value} onClick={() => { updateOption('fontFamily', font.value); setShowFontDropdown(false); }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${options.fontFamily === font.value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}
                                style={{ fontFamily: font.value }}>
                                {font.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Font Size */}
            <div className="relative">
                <button
                    onClick={() => { setShowSizeDropdown(!showSizeDropdown); setShowFontDropdown(false); setShowFormattingPanel(false); setShowAlignmentPanel(false); setShowListPanel(false); }}
                    className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1 min-w-[70px]"
                >
                    <span className="flex-1 text-left">{options.fontSize}</span>
                    <ChevronDown className="w-3 h-3" />
                </button>
                {showSizeDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-24 max-h-64 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20">
                        {fontSizes.map(size => (
                            <button key={size} onClick={() => { updateOption('fontSize', size); setShowSizeDropdown(false); }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${options.fontSize === size ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                {size}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

            {/* Text Formatting */}
            <div className="relative">
                <button
                    onClick={() => { setShowFormattingPanel(!showFormattingPanel); setShowFontDropdown(false); setShowSizeDropdown(false); setShowAlignmentPanel(false); setShowListPanel(false); }}
                    className={`p-2 rounded transition-colors flex items-center gap-1 ${isAnyFormattingActive() ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    title="Text Formatting"
                >
                    <Type className="w-4 h-4" />
                    <ChevronDown className="w-3 h-3" />
                </button>
                {showFormattingPanel && (
                    <TextFormattingPanel options={options} onUpdate={updateOption} formattingOptions={formattingOptions} onClose={() => setShowFormattingPanel(false)} />
                )}
            </div>

            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

            {/* Alignment */}
            <div className="relative">
                <button
                    onClick={() => { setShowAlignmentPanel(!showAlignmentPanel); setShowFontDropdown(false); setShowSizeDropdown(false); setShowFormattingPanel(false); setShowListPanel(false); }}
                    className={`p-2 rounded transition-colors flex items-center gap-1 ${options.textAlign !== 'left' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    title="Text Alignment"
                >
                    {options.textAlign === 'center' ? <AlignCenter className="w-4 h-4" /> : options.textAlign === 'right' ? <AlignRight className="w-4 h-4" /> : <AlignLeft className="w-4 h-4" />}
                    <ChevronDown className="w-3 h-3" />
                </button>
                {showAlignmentPanel && (
                    <TextAlignmentPanel options={options} onUpdate={updateOption} alignmentOptions={alignmentOptions} onClose={() => setShowAlignmentPanel(false)} />
                )}
            </div>

            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

            {/* List */}
            <div className="relative">
                <button
                    onClick={() => { setShowListPanel(!showListPanel); setShowFontDropdown(false); setShowSizeDropdown(false); setShowFormattingPanel(false); setShowAlignmentPanel(false); }}
                    className={`p-2 rounded transition-colors flex items-center gap-1 ${options.listType !== 'none' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    title="List Formatting"
                >
                    {options.listType === 'ordered' ? <ListOrdered className="w-4 h-4" /> : <List className="w-4 h-4" />}
                    <ChevronDown className="w-3 h-3" />
                </button>
                {showListPanel && (
                    <ListFormatPanel options={options} onUpdate={updateOption} listOptions={listOptions} onClose={() => setShowListPanel(false)} />
                )}
            </div>

            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

            {/* Text Color */}
            <div className="relative">
                <button
                    onClick={() => { setShowTextColorPanel(!showTextColorPanel); setShowFontDropdown(false); setShowSizeDropdown(false); setShowFormattingPanel(false); setShowAlignmentPanel(false); setShowListPanel(false); setShowBgColorPanel(false); }}
                    className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                    style={{ backgroundColor: options.textColor }}
                    title="Text Color"
                >
                    <Type className="w-4 h-4" style={{ color: getContrastColor(options.textColor), filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }} />
                </button>
                {showTextColorPanel && (
                    <ColorPickerPanel value={options.textColor} onChange={(color) => updateOption('textColor', color)} type="text" onClose={() => setShowTextColorPanel(false)} />
                )}
            </div>

            {/* Background Color */}
            <div className="relative">
                <button
                    onClick={() => { setShowBgColorPanel(!showBgColorPanel); setShowFontDropdown(false); setShowSizeDropdown(false); setShowFormattingPanel(false); setShowAlignmentPanel(false); setShowListPanel(false); setShowTextColorPanel(false); }}
                    className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 cursor-pointer hover:scale-105 transition-transform"
                    style={{
                        backgroundColor: options.backgroundColor === 'transparent' ? 'transparent' : options.backgroundColor,
                        backgroundImage: options.backgroundColor === 'transparent' ? 'linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%, #e0e0e0), linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%, #e0e0e0)' : 'none',
                        backgroundSize: '8px 8px',
                        backgroundPosition: '0 0, 4px 4px'
                    }}
                    title="Background Color"
                />
                {showBgColorPanel && (
                    <ColorPickerPanel value={options.backgroundColor} onChange={(color) => updateOption('backgroundColor', color)} type="background" onClose={() => setShowBgColorPanel(false)} position="top" />
                )}
            </div>

            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

            {/* Layer Order */}
            <button
                onClick={() => {
                    if (!canvasManager || !textObject) return;
                    const cmd = new LayerOrderCommand([textObject.id], 'front');
                    canvasManager.executeCommand(cmd);
                }}
                className="p-2 rounded transition-colors bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                title="Bring to Front"
            >
                <BringToFront className="w-4 h-4" />
            </button>
            <button
                onClick={() => {
                    if (!canvasManager || !textObject) return;
                    const cmd = new LayerOrderCommand([textObject.id], 'back');
                    canvasManager.executeCommand(cmd);
                }}
                className="p-2 rounded transition-colors bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                title="Send to Back"
            >
                <SendToBack className="w-4 h-4" />
            </button>
        </div>
    );
}

function getContrastColor(hexColor) {
    if (!hexColor || hexColor === 'transparent') return '#000000';
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return ((0.299 * r + 0.587 * g + 0.114 * b) / 255) > 0.5 ? '#000000' : '#FFFFFF';
}