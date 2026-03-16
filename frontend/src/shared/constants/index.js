// src/constants.js - UPDATED WITH PENCIL ENHANCEMENTS

// For Separate Tools Properties 
export const TOOL_OPTIONS = {
  // Drawing options
  COLOR: "color",
  WIDTH: "width",
  OPACITY: "opacity",
  FILL_COLOR: "fillColor",
  // Text options
  FONT_FAMILY: "fontFamily",
  FONT_SIZE: "fontSize",
  TEXT_COLOR: "textColor",
  TEXT_ALIGN: "textAlign",
  // Shape options
  SHAPE_TYPE: "shapeType",
  // Line options
  LINE_CAP: "lineCap",
  LINE_JOIN: "lineJoin",
  // Arrow options
  CORNER_RADIUS: "cornerRadius",
  ARROW_SIZE: "arrowSize",
};

// Shape types - simplified
export const SHAPE_TYPES = {
  RECTANGLE: "rectangle",
  CIRCLE: "circle",
  ELLIPSE: "ellipse",
  LINE: "line",
  ARROW: "arrow",
  TRIANGLE: "triangle",
  DIAMOND: "diamond",
  STAR: "star",
  HEXAGON: "hexagon",
  PENTAGON: "pentagon",
  POLYGON: "polygon",
};

// Tool types
export const TOOL_TYPES = {
  SELECT: 'select',
  PENCIL: 'pencil',
  SHAPE: 'shape',
  TEXT: 'text',
  IMAGE: 'image',
  ERASER: 'eraser',
  OBJECT_ERASER: 'object-eraser',
  EMOJI: 'emoji',
  STICKY: 'sticky',
  DELETE: 'delete',
};

// Pencil styles
export const PENCIL_STYLES = {
  SKETCH: 'sketch',
  SMOOTH: 'smooth',
  HIGHLIGHTER: 'highlighter'
};

// Highlighter colors
export const HIGHLIGHTER_COLORS = {
  YELLOW: '#FFEB3B',
  GREEN: '#4CAF50',
  PINK: '#FF4081'
};

// Selection types
export const SELECTION_TYPES = {
  RECTANGLE: "rectangle",
};

// Grid Modes
export const GRID_MODES = {
  NONE: 'none',
  LINES: 'lines',
};

// Zoom levels
export const ZOOM_LEVELS = [0.01, 0.02, 0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 3.5, 4.0];

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  SELECT: 'v',
  PENCIL: 'p',
  SHAPE: 's',
  TEXT: 't',
  ERASER: 'e',
  EMOJI: 'j',
  STICKY: 'n',
  IMAGE: 'i',
  UNDO: 'ctrl+z',
  REDO: 'ctrl+shift+z',
  DELETE: 'delete',
  SELECT_ALL: 'ctrl+a',
  COPY: 'ctrl+c',
  PASTE: 'ctrl+v',
  CUT: 'ctrl+x',
  ZOOM_IN: 'ctrl+=',
  ZOOM_OUT: 'ctrl+-',
  RESET_VIEW: 'ctrl+0',
  TOGGLE_GRID: 'ctrl+g',
  TOGGLE_SHORTCUTS: '?',
  ESCAPE: 'escape',
  SPACE: 'space',
};

// Tool display names
export const TOOL_NAMES = {
  [TOOL_TYPES.SELECT]: 'Select',
  [TOOL_TYPES.PENCIL]: 'Pencil',
  [TOOL_TYPES.SHAPE]: 'Shape',
  [TOOL_TYPES.TEXT]: 'Text',
  [TOOL_TYPES.IMAGE]: 'Image',
  [TOOL_TYPES.ERASER]: 'Eraser',
  [TOOL_TYPES.OBJECT_ERASER]: 'Object Eraser',
  [TOOL_TYPES.EMOJI]: 'Emoji',
  [TOOL_TYPES.STICKY]: 'Sticky Note',
  //[TOOL_TYPES.CONNECTOR]: 'Connector',
  [TOOL_TYPES.DELETE]: 'Delete',
};

// Tool order in toolbar
export const TOOL_ORDER = [
  TOOL_TYPES.SELECT,
  TOOL_TYPES.PENCIL,
  TOOL_TYPES.SHAPE,
  TOOL_TYPES.TEXT,
  TOOL_TYPES.IMAGE,
  TOOL_TYPES.ERASER,
  TOOL_TYPES.OBJECT_ERASER,
  TOOL_TYPES.EMOJI,
  TOOL_TYPES.STICKY,
  TOOL_TYPES.DELETE,
];

// Colors for tools and UI
export const COLORS = {
  PRIMARY: '#3B82F6',
  SUCCESS: '#10B981',
  WARNING: '#F59E0B',
  DANGER: '#EF4444',
};

// Z-index layers
export const Z_INDEX = {
  CANVAS: 0,
  GRID: 1,
  SELECTION: 10,
  CURSORS: 20,
  UI: 50,
  CHAT: 60,
  DROPDOWNS: 70,
  MODALS: 100,
  TOASTS: 110,
};

// Base defaults for all tools
export const BASE_TOOL_OPTIONS = {
  [TOOL_OPTIONS.COLOR]: '#000000',
  [TOOL_OPTIONS.WIDTH]: 2,
  [TOOL_OPTIONS.OPACITY]: 1.0,
  [TOOL_OPTIONS.FILL_COLOR]: 'transparent',
  [TOOL_OPTIONS.FONT_FAMILY]: 'Arial, sans-serif',
  [TOOL_OPTIONS.FONT_SIZE]: 16,
  [TOOL_OPTIONS.TEXT_COLOR]: '#000000',
  [TOOL_OPTIONS.TEXT_ALIGN]: 'left',
  [TOOL_OPTIONS.SHAPE_TYPE]: SHAPE_TYPES.RECTANGLE,
  [TOOL_OPTIONS.LINE_CAP]: 'round',
  [TOOL_OPTIONS.LINE_JOIN]: 'round',
};

// Define tool-specific defaults
export const DEFAULT_TOOL_OPTIONS = {
  [TOOL_TYPES.PENCIL]: {
    [TOOL_OPTIONS.WIDTH]: 2,
    [TOOL_OPTIONS.COLOR]: '#000000', // Auto-detect based on dark mode
    [TOOL_OPTIONS.OPACITY]: 1.0,
    [TOOL_OPTIONS.LINE_CAP]: 'round',
    [TOOL_OPTIONS.LINE_JOIN]: 'round',
    style: PENCIL_STYLES.SMOOTH, // Default to smooth
    pressureSensitivity: false, // OFF by default
    highlighterColor: 'yellow', // For highlighter mode
  },
  [TOOL_TYPES.SHAPE]: {
    [TOOL_OPTIONS.WIDTH]: 2,
    [TOOL_OPTIONS.COLOR]: '#000000',
    [TOOL_OPTIONS.FILL_COLOR]: 'transparent',
    [TOOL_OPTIONS.SHAPE_TYPE]: SHAPE_TYPES.RECTANGLE,
    [TOOL_OPTIONS.OPACITY]: 1.0,
    cornerRadius: 10, // For rounded rectangle
    sides: 6, // For polygon
    starPoints: 5, // For star
    arrowSize: 10, // For arrow
  },
  [TOOL_TYPES.TEXT]: {
    [TOOL_OPTIONS.FONT_FAMILY]: 'Arial, sans-serif',
    [TOOL_OPTIONS.FONT_SIZE]: 16,
    [TOOL_OPTIONS.TEXT_COLOR]: '#000000',
    [TOOL_OPTIONS.TEXT_ALIGN]: 'left',
    [TOOL_OPTIONS.FILL_COLOR]: 'transparent',
    fontWeight: 'normal',
    fontStyle: 'normal',
    underline: false,
  },
  [TOOL_TYPES.ERASER]: {
    [TOOL_OPTIONS.WIDTH]: 10,
    [TOOL_OPTIONS.COLOR]: '#FFFFFF',
  },
  [TOOL_TYPES.OBJECT_ERASER]: {
    [TOOL_OPTIONS.WIDTH]: 10,
    [TOOL_OPTIONS.COLOR]: '#FFFFFF',
  },
  [TOOL_TYPES.EMOJI]: {
    emoji: '😀',
    [TOOL_OPTIONS.OPACITY]: 1.0,
  },
  [TOOL_TYPES.STICKY]: {
    noteColor: 'yellow',
    fontSize: 16,
    [TOOL_OPTIONS.OPACITY]: 1.0,
  },
};