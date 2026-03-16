/**
 * Test helpers — shared state factory & utilities for all test phases.
 */

/**
 * Create a fresh canvas state object (mirrors CanvasManager.state).
 */
export function createState(overrides = {}) {
  return {
    objects: [],
    layers: {
      default: { id: 'default', name: 'Default', visible: true, locked: false },
    },
    currentLayer: 'default',
    selection: [],
    viewport: { zoom: 1, panX: 0, panY: 0 },
    gridStyle: 'lines',
    darkMode: false,
    canvasBounds: { minX: -5000, maxX: 5000, minY: -5000, maxY: 5000, width: 10000, height: 10000 },
    ...overrides,
  };
}

/**
 * Create a sample rectangle object.
 */
export function makeRect(overrides = {}) {
  return {
    id: overrides.id || 'rect_1',
    type: 'rectangle',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    strokeColor: '#000000',
    strokeWidth: 2,
    fillColor: 'transparent',
    opacity: 1,
    layer: 'default',
    visible: true,
    rotation: 0,
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a sample circle object.
 */
export function makeCircle(overrides = {}) {
  return {
    id: overrides.id || 'circle_1',
    type: 'circle',
    x: 300,
    y: 300,
    radius: 50,
    strokeColor: '#000000',
    strokeWidth: 2,
    fillColor: 'transparent',
    opacity: 1,
    layer: 'default',
    visible: true,
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a sample line object.
 */
export function makeLine(overrides = {}) {
  return {
    id: overrides.id || 'line_1',
    type: 'line',
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 100,
    strokeColor: '#000000',
    strokeWidth: 2,
    opacity: 1,
    layer: 'default',
    visible: true,
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a sample text object.
 */
export function makeText(overrides = {}) {
  return {
    id: overrides.id || 'text_1',
    type: 'text',
    x: 50,
    y: 50,
    text: 'Hello World',
    placeholder: 'Type something...',
    fontFamily: 'Arial, sans-serif',
    fontSize: 16,
    textColor: '#000000',
    backgroundColor: 'transparent',
    textAlign: 'left',
    fontWeight: 'normal',
    fontStyle: 'normal',
    underline: false,
    strikethrough: false,
    listType: 'none',
    width: 200,
    height: 50,
    rotation: 0,
    opacity: 1,
    layer: 'default',
    isEditing: false,
    lockedBy: null,
    formattedRanges: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a sample drawing (pencil) object.
 */
export function makeDrawing(overrides = {}) {
  return {
    id: overrides.id || 'drawing_1',
    type: 'drawing',
    points: [
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 30, y: 15 },
      { x: 40, y: 25 },
    ],
    strokeColor: '#000000',
    strokeWidth: 2,
    opacity: 1,
    layer: 'default',
    visible: true,
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a sample triangle object.
 */
export function makeTriangle(overrides = {}) {
  return {
    id: overrides.id || 'tri_1',
    type: 'triangle',
    points: [
      { x: 100, y: 50 },
      { x: 50, y: 150 },
      { x: 150, y: 150 },
    ],
    strokeColor: '#000000',
    strokeWidth: 2,
    fillColor: 'transparent',
    opacity: 1,
    layer: 'default',
    visible: true,
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a sample ellipse object.
 */
export function makeEllipse(overrides = {}) {
  return {
    id: overrides.id || 'ellipse_1',
    type: 'ellipse',
    x: 200,
    y: 200,
    radiusX: 80,
    radiusY: 40,
    strokeColor: '#000000',
    strokeWidth: 2,
    fillColor: 'transparent',
    opacity: 1,
    layer: 'default',
    visible: true,
    createdAt: Date.now(),
    ...overrides,
  };
}
