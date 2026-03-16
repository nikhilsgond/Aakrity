// src/features/canvas/engine/smartGuides/index.js
export { drawSmartGuides } from './SmartGuideRenderer.js';
export { default as SmartGuideState } from './SmartGuideState.js';
export {
  queryMoveGuides,
  findAlignmentGuides,
  findSpacingGuides,
  findDimensionMatches,
  findLengthMatches,
  snapRotation,
  snapAspectRatio,
  getObjectEdges,
  getGroupEdges,
  ALIGN_SNAP_ENTRY,
  ALIGN_SNAP_EXIT,
  DIM_SNAP_ENTRY,
  DIM_SNAP_EXIT,
  ROTATION_SNAP_ANGLES,
} from './SmartGuideEngine.js';
