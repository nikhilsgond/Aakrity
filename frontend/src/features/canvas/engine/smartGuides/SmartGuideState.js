// src/features/canvas/engine/smartGuides/SmartGuideState.js
//
// Lightweight session state for the currently-active smart guide data.
// Lives on CanvasManager — no Zustand, no React, just a plain object.
// One instance per canvas.

export default class SmartGuideState {
  constructor() {
    this.reset();
  }

  /** Clear all guide data (call on interaction end) */
  reset() {
    /** @type {'idle'|'move'|'resize'|'rotate'} */
    this.mode = 'idle';

    // Alignment guides for the current frame
    this.alignGuides = [];

    // Spacing guides for the current frame
    this.spacingGuides = [];

    // Dimension match labels
    this.dimensionMatches = [];

    // Rotation snap info
    this.rotationSnap = null;

    // Hysteresis state for alignment snapping
    this.currentAlignSnaps = { x: null, xEdge: null, y: null, yEdge: null };

    // Hysteresis state for rotation snapping
    this.currentRotationSnap = null;

    // Whether snapping is suppressed (Ctrl held)
    this.suppressed = false;
  }

  /** Are there any guides to render? */
  hasGuides() {
    if (this.suppressed || this.mode === 'idle') return false;
    return (
      this.alignGuides.length > 0 ||
      this.spacingGuides.length > 0 ||
      this.dimensionMatches.length > 0 ||
      (this.rotationSnap && this.rotationSnap.isSnapped)
    );
  }

  /** Get the data package for the renderer */
  getRenderData() {
    if (!this.hasGuides()) return null;
    return {
      alignGuides:     this.alignGuides,
      spacingGuides:   this.spacingGuides,
      dimensionMatches: this.dimensionMatches,
      rotationSnap:    this.rotationSnap,
    };
  }
}
