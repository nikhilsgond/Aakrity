// src/features/canvas/engine/smartGuides/SmartGuideEngine.js
//
// Pure computation engine for Smart Guides & Snapping.
// No rendering, no DOM, no side effects — just math.
// All public methods are static or take explicit parameters.

import ObjectGeometry from '../geometry/ObjectGeometry.js';

// ─── Configuration ──────────────────────────────────────────

/** Pixel tolerance (world units) for alignment snap entry */
export const ALIGN_SNAP_ENTRY = 6;
/** Pixel tolerance (world units) for alignment snap exit (hysteresis) */
export const ALIGN_SNAP_EXIT = 10;

/** Tolerance for dimension/radius/length matching */
export const DIM_SNAP_ENTRY = 6;
export const DIM_SNAP_EXIT = 10;

/** Tolerance for equal spacing snap */
export const SPACING_SNAP_ENTRY = 6;
export const SPACING_SNAP_EXIT = 10;

/** Rotation snap angles (degrees).  Cardinal + diagonal. */
export const ROTATION_SNAP_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
/** Rotation snap tolerance (degrees) */
export const ROTATION_SNAP_ENTRY_DEG = 4;
export const ROTATION_SNAP_EXIT_DEG = 7;

/** Aspect ratios to snap to: [w, h] pairs normalised so max = 1 */
export const CLEAN_RATIOS = [
  [1, 1], [1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2],
];
export const RATIO_SNAP_ENTRY = 0.04;  // tolerance as fraction of ratio
export const RATIO_SNAP_EXIT = 0.07;

// ─── Types we skip for guide comparisons ────────────────────

const SKIP_TYPES = new Set(['drawing']);

// ─── Bounds helper ──────────────────────────────────────────

/**
 * Extract the 5 key positions on each axis for an object:
 *   left, centerX, right, top, centerY, bottom
 * Returns null for objects we skip.
 */
export function getObjectEdges(obj) {
  if (!obj || SKIP_TYPES.has(obj.type)) return null;
  const b = ObjectGeometry.getBounds(obj);
  if (!b) return null;
  return {
    left:    b.x,
    right:   b.x + b.width,
    centerX: b.x + b.width / 2,
    top:     b.y,
    bottom:  b.y + b.height,
    centerY: b.y + b.height / 2,
    width:   b.width,
    height:  b.height,
    bounds:  b,
  };
}

/**
 * Build edges for a group bounding box (multi-select).
 */
export function getGroupEdges(bounds) {
  if (!bounds) return null;
  return {
    left:    bounds.x,
    right:   bounds.x + bounds.width,
    centerX: bounds.x + bounds.width / 2,
    top:     bounds.y,
    bottom:  bounds.y + bounds.height,
    centerY: bounds.y + bounds.height / 2,
    width:   bounds.width,
    height:  bounds.height,
    bounds,
  };
}

// ─── Alignment detection ────────────────────────────────────

/**
 * Compare the active object/group edges against every other object.
 * Returns { guides: [...], snapDelta: { x, y } }
 *
 * Each guide: { axis: 'x'|'y', value: number, activeEdge: string, matchEdge: string,
 *               activeSpan: [min, max], matchSpan: [min, max], matchObjId: string }
 *
 * @param {Object} activeEdges — edges of the object being moved
 * @param {Array}  otherObjects — all other canvas objects (not the active ones)
 * @param {Object} currentSnaps — { x: number|null, y: number|null } for hysteresis
 * @param {number} threshold — snap entry distance
 * @param {number} exitThreshold — snap exit distance
 */
export function findAlignmentGuides(activeEdges, otherObjects, currentSnaps, threshold = ALIGN_SNAP_ENTRY, exitThreshold = ALIGN_SNAP_EXIT) {
  const guides = [];
  let bestX = null; // { dist, snapValue, delta, edge }
  let bestY = null;

  // X-axis edges (vertical guide lines): left, centerX, right
  const xEdges = [
    { name: 'left',    value: activeEdges.left },
    { name: 'centerX', value: activeEdges.centerX },
    { name: 'right',   value: activeEdges.right },
  ];
  // Y-axis edges (horizontal guide lines): top, centerY, bottom
  const yEdges = [
    { name: 'top',     value: activeEdges.top },
    { name: 'centerY', value: activeEdges.centerY },
    { name: 'bottom',  value: activeEdges.bottom },
  ];

  for (const other of otherObjects) {
    const oe = getObjectEdges(other);
    if (!oe) continue;

    const otherXEdges = [
      { name: 'left',    value: oe.left },
      { name: 'centerX', value: oe.centerX },
      { name: 'right',   value: oe.right },
    ];
    const otherYEdges = [
      { name: 'top',     value: oe.top },
      { name: 'centerY', value: oe.centerY },
      { name: 'bottom',  value: oe.bottom },
    ];

    // Compare every active X edge against every other X edge
    for (const ae of xEdges) {
      for (const ome of otherXEdges) {
        const dist = Math.abs(ae.value - ome.value);
        if (dist <= threshold) {
          const delta = ome.value - ae.value;
          if (!bestX || dist < bestX.dist) {
            bestX = { dist, snapValue: ome.value, delta, edge: ae.name };
          }
          guides.push({
            axis: 'x',
            value: ome.value,
            activeEdge: ae.name,
            matchEdge: ome.name,
            activeSpan: [activeEdges.top, activeEdges.bottom],
            matchSpan:  [oe.top, oe.bottom],
            matchObjId: other.id,
          });
        }
      }
    }

    // Compare every active Y edge against every other Y edge
    for (const ae of yEdges) {
      for (const ome of otherYEdges) {
        const dist = Math.abs(ae.value - ome.value);
        if (dist <= threshold) {
          const delta = ome.value - ae.value;
          if (!bestY || dist < bestY.dist) {
            bestY = { dist, snapValue: ome.value, delta, edge: ae.name };
          }
          guides.push({
            axis: 'y',
            value: ome.value,
            activeEdge: ae.name,
            matchEdge: ome.name,
            activeSpan: [activeEdges.left, activeEdges.right],
            matchSpan:  [oe.left, oe.right],
            matchObjId: other.id,
          });
        }
      }
    }
  }

  // Hysteresis: if we were already snapped, only release if beyond exit threshold
  let snapDeltaX = 0;
  let snapDeltaY = 0;

  if (currentSnaps.x !== null) {
    // Currently snapped on X
    const currentDist = Math.abs(activeEdges[currentSnaps.xEdge] - currentSnaps.x);
    if (currentDist <= exitThreshold) {
      snapDeltaX = currentSnaps.x - activeEdges[currentSnaps.xEdge];
    } else if (bestX) {
      snapDeltaX = bestX.delta;
    }
  } else if (bestX) {
    snapDeltaX = bestX.delta;
  }

  if (currentSnaps.y !== null) {
    const currentDist = Math.abs(activeEdges[currentSnaps.yEdge] - currentSnaps.y);
    if (currentDist <= exitThreshold) {
      snapDeltaY = currentSnaps.y - activeEdges[currentSnaps.yEdge];
    } else if (bestY) {
      snapDeltaY = bestY.delta;
    }
  } else if (bestY) {
    snapDeltaY = bestY.delta;
  }

  return {
    guides,
    snapDelta: { x: snapDeltaX, y: snapDeltaY },
    newSnaps: {
      x: bestX ? bestX.snapValue : null,
      xEdge: bestX ? bestX.edge : null,
      y: bestY ? bestY.snapValue : null,
      yEdge: bestY ? bestY.edge : null,
    },
  };
}

// ─── Equal spacing detection ────────────────────────────────

/**
 * Detect equal-spacing relationships along one axis.
 * Returns an array of spacing guides: { axis, gaps: [{from, to, gap}], value }
 *
 * Algorithm: Sort all objects + active along axis → find neighboring pairs
 * that have the same gap as a neighbor pair involving the active obj.
 */
export function findSpacingGuides(activeEdges, otherObjects, threshold = SPACING_SNAP_ENTRY) {
  const guides = [];
  const spacingSnap = { x: 0, y: 0 };

  // Process each axis independently
  for (const axis of ['x', 'y']) {
    const isX = axis === 'x';
    const startProp = isX ? 'left' : 'top';
    const endProp   = isX ? 'right' : 'bottom';
    const perpStart = isX ? 'top' : 'left';
    const perpEnd   = isX ? 'bottom' : 'right';

    // Collect all object intervals on this axis
    const intervals = [];
    for (const obj of otherObjects) {
      const e = getObjectEdges(obj);
      if (!e) continue;
      intervals.push({
        id: obj.id,
        start: e[startProp],
        end:   e[endProp],
        perpStart: e[perpStart],
        perpEnd:   e[perpEnd],
        isActive: false,
      });
    }

    // Add active object
    intervals.push({
      id: '__active__',
      start: activeEdges[startProp],
      end:   activeEdges[endProp],
      perpStart: activeEdges[perpStart],
      perpEnd:   activeEdges[perpEnd],
      isActive: true,
    });

    // Sort by start position
    intervals.sort((a, b) => a.start - b.start);

    // Find gaps between consecutive non-overlapping objects
    const gaps = [];
    for (let i = 0; i < intervals.length - 1; i++) {
      for (let j = i + 1; j < intervals.length; j++) {
        const gap = intervals[j].start - intervals[i].end;
        if (gap < 1) continue; // overlapping or touching
        // Only consider nearest neighbor (no objects between them on this axis)
        let blocked = false;
        for (let k = i + 1; k < j; k++) {
          if (intervals[k].start >= intervals[i].end && intervals[k].end <= intervals[j].start) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        gaps.push({
          from: intervals[i],
          to:   intervals[j],
          gap,
          involvesActive: intervals[i].isActive || intervals[j].isActive,
        });
        break; // only nearest neighbor for each i
      }
    }

    // Find matching gap pairs
    for (const activeGap of gaps.filter(g => g.involvesActive)) {
      for (const otherGap of gaps.filter(g => !g.involvesActive)) {
        const diff = Math.abs(activeGap.gap - otherGap.gap);
        if (diff <= threshold) {
          const snapAdjust = otherGap.gap - activeGap.gap;
          guides.push({
            axis,
            equalGap: otherGap.gap,
            activeGap: {
              start: activeGap.from.end,
              end:   activeGap.to.start,
              perpStart: Math.min(activeGap.from.perpStart, activeGap.to.perpStart),
              perpEnd:   Math.max(activeGap.from.perpEnd, activeGap.to.perpEnd),
            },
            matchGap: {
              start: otherGap.from.end,
              end:   otherGap.to.start,
              perpStart: Math.min(otherGap.from.perpStart, otherGap.to.perpStart),
              perpEnd:   Math.max(otherGap.from.perpEnd, otherGap.to.perpEnd),
            },
          });

          // Snap: adjust the active position so its gap exactly matches
          if (Math.abs(snapAdjust) < Math.abs(isX ? spacingSnap.x : spacingSnap.y) || (isX ? spacingSnap.x : spacingSnap.y) === 0) {
            if (isX) {
              // Determine which side of the active object the gap is on
              if (activeGap.from.isActive) {
                spacingSnap.x = -snapAdjust; // active is on left, shift left
              } else {
                spacingSnap.x = snapAdjust;  // active is on right, shift right
              }
            } else {
              if (activeGap.from.isActive) {
                spacingSnap.y = -snapAdjust;
              } else {
                spacingSnap.y = snapAdjust;
              }
            }
          }
        }
      }
    }
  }

  return { guides, spacingSnap };
}

// ─── Dimension matching (for resize) ────────────────────────

/**
 * Find objects whose width/height/radius matches the active object's
 * current dimension being resized.
 *
 * @param {string}  dimension — 'width' | 'height' | 'radius' | 'radiusX' | 'radiusY'
 * @param {number}  currentValue — the live value of the dimension
 * @param {Array}   otherObjects — all other objects to compare against
 * @param {number}  threshold
 * @returns {{ matches: Array<{objId, value, dimension}>, snapValue: number|null }}
 */
export function findDimensionMatches(dimension, currentValue, otherObjects, threshold = DIM_SNAP_ENTRY) {
  const matches = [];
  let bestDist = Infinity;
  let snapValue = null;

  for (const obj of otherObjects) {
    if (SKIP_TYPES.has(obj.type)) continue;

    let targetValue = null;

    if (dimension === 'width') {
      const b = ObjectGeometry.getBounds(obj);
      if (b) targetValue = b.width;
    } else if (dimension === 'height') {
      const b = ObjectGeometry.getBounds(obj);
      if (b) targetValue = b.height;
    } else if (dimension === 'radius') {
      if (obj.type === 'circle') targetValue = obj.radius;
    } else if (dimension === 'radiusX') {
      if (obj.type === 'ellipse') targetValue = obj.radiusX;
      else if (obj.type === 'circle') targetValue = obj.radius;
    } else if (dimension === 'radiusY') {
      if (obj.type === 'ellipse') targetValue = obj.radiusY;
      else if (obj.type === 'circle') targetValue = obj.radius;
    }

    if (targetValue === null || targetValue <= 0) continue;

    const dist = Math.abs(currentValue - targetValue);
    if (dist <= threshold) {
      matches.push({ objId: obj.id, value: targetValue, dimension });
      if (dist < bestDist) {
        bestDist = dist;
        snapValue = targetValue;
      }
    }
  }

  return { matches, snapValue };
}

// ─── Line / connector length matching ───────────────────────

/**
 * Get the length of a line/arrow/connector.
 */
export function getLineLength(obj) {
  if (!obj) return null;
  if (obj.type === 'line' || obj.type === 'arrow') {
    const dx = (obj.x2 ?? 0) - (obj.x1 ?? 0);
    const dy = (obj.y2 ?? 0) - (obj.y1 ?? 0);
    return Math.sqrt(dx * dx + dy * dy);
  }
  return null;
}

/**
 * Find line-length matches for the active line being resized.
 */
export function findLengthMatches(currentLength, otherObjects, threshold = DIM_SNAP_ENTRY) {
  const matches = [];
  let bestDist = Infinity;
  let snapValue = null;

  for (const obj of otherObjects) {
    const len = getLineLength(obj);
    if (len === null || len <= 0) continue;
    const dist = Math.abs(currentLength - len);
    if (dist <= threshold) {
      matches.push({ objId: obj.id, value: len });
      if (dist < bestDist) {
        bestDist = dist;
        snapValue = len;
      }
    }
  }

  return { matches, snapValue };
}

// ─── Rotation snapping ─────────────────────────────────────

/**
 * Snap a rotation angle (radians) to the nearest cardinal/diagonal.
 *
 * @param {number}  angleRad — current total rotation in radians
 * @param {number|null}  currentSnap — the angle we are currently snapped to (radians), or null
 * @returns {{ snappedAngle: number, isSnapped: boolean, snapDegrees: number|null }}
 */
export function snapRotation(angleRad, currentSnap = null) {
  const DEG = 180 / Math.PI;
  const RAD = Math.PI / 180;

  // Normalise to 0..360
  let deg = ((angleRad * DEG) % 360 + 360) % 360;

  // If currently snapped, apply hysteresis
  if (currentSnap !== null) {
    const snapDeg = ((currentSnap * DEG) % 360 + 360) % 360;
    if (Math.abs(deg - snapDeg) <= ROTATION_SNAP_EXIT_DEG ||
        Math.abs(deg - snapDeg - 360) <= ROTATION_SNAP_EXIT_DEG ||
        Math.abs(deg - snapDeg + 360) <= ROTATION_SNAP_EXIT_DEG) {
      return { snappedAngle: currentSnap, isSnapped: true, snapDegrees: Math.round(snapDeg) };
    }
  }

  // Find nearest snap angle
  let bestDist = Infinity;
  let bestDeg = null;

  for (const target of ROTATION_SNAP_ANGLES) {
    let d = Math.abs(deg - target);
    if (d > 180) d = 360 - d;
    if (d < bestDist) {
      bestDist = d;
      bestDeg = target;
    }
  }

  if (bestDist <= ROTATION_SNAP_ENTRY_DEG) {
    // Snap: convert target degree back to radians, preserving full-turn count
    const fullTurns = Math.round(angleRad / (2 * Math.PI));
    let snappedRad = bestDeg * RAD + fullTurns * 2 * Math.PI;
    // Pick the closest equivalent
    const candidates = [snappedRad, snappedRad - 2 * Math.PI, snappedRad + 2 * Math.PI];
    snappedRad = candidates.reduce((a, b) => Math.abs(a - angleRad) < Math.abs(b - angleRad) ? a : b);
    return { snappedAngle: snappedRad, isSnapped: true, snapDegrees: bestDeg };
  }

  return { snappedAngle: angleRad, isSnapped: false, snapDegrees: null };
}

// ─── Aspect ratio snapping ─────────────────────────────────

/**
 * Snap current width/height to a clean aspect ratio or to another
 * object's aspect ratio.
 *
 * @param {number}  w — current width
 * @param {number}  h — current height
 * @param {Array}   otherObjects — for matching ratios
 * @param {number}  threshold — tolerance for ratio matching
 * @returns {{ snappedW: number, snappedH: number, isSnapped: boolean, ratioLabel: string|null }}
 */
export function snapAspectRatio(w, h, otherObjects = [], threshold = RATIO_SNAP_ENTRY) {
  if (w <= 0 || h <= 0) return { snappedW: w, snappedH: h, isSnapped: false, ratioLabel: null };

  const currentRatio = w / h;

  // Collect candidate ratios: clean ratios + other objects' ratios
  const candidates = CLEAN_RATIOS.map(([rw, rh]) => ({
    ratio: rw / rh,
    label: `${rw}:${rh}`,
    priority: 0, // generic
  }));

  for (const obj of otherObjects) {
    if (SKIP_TYPES.has(obj.type)) continue;
    const b = ObjectGeometry.getBounds(obj);
    if (!b || b.width <= 0 || b.height <= 0) continue;
    const r = b.width / b.height;
    candidates.push({ ratio: r, label: null, priority: 1 }); // specific object
  }

  let bestDist = Infinity;
  let bestCandidate = null;

  for (const c of candidates) {
    const dist = Math.abs(currentRatio - c.ratio) / Math.max(currentRatio, c.ratio);
    if (dist < bestDist && dist <= threshold) {
      bestDist = dist;
      bestCandidate = c;
    }
  }

  if (bestCandidate) {
    // Adjust: keep the larger dimension, adjust the smaller
    const targetRatio = bestCandidate.ratio;
    let snappedW, snappedH;
    if (currentRatio > targetRatio) {
      // width is too large relative to height → shrink width
      snappedW = h * targetRatio;
      snappedH = h;
    } else {
      snappedW = w;
      snappedH = w / targetRatio;
    }
    return {
      snappedW,
      snappedH,
      isSnapped: true,
      ratioLabel: bestCandidate.label || `${Math.round(snappedW)}:${Math.round(snappedH)}`,
    };
  }

  return { snappedW: w, snappedH: h, isSnapped: false, ratioLabel: null };
}

// ─── Consolidated query for move operations ─────────────────

/**
 * One-call query during a move operation.
 * Returns all active guides + the total snap correction delta.
 *
 * @param {Object}  movingBounds — { x, y, width, height } of the object(s) being moved
 * @param {Array}   allObjects — full objects array
 * @param {Array}   movingIds — IDs of objects being moved (excluded from comparisons)
 * @param {Object}  currentSnaps — hysteresis state { x, xEdge, y, yEdge }
 * @returns {{ alignGuides, spacingGuides, snapDelta, newSnaps }}
 */
export function queryMoveGuides(movingBounds, allObjects, movingIds, currentSnaps) {
  const movingSet = new Set(movingIds);
  const others = allObjects.filter(o => !movingSet.has(o.id) && !SKIP_TYPES.has(o.type));

  if (others.length === 0) {
    return {
      alignGuides: [],
      spacingGuides: [],
      snapDelta: { x: 0, y: 0 },
      newSnaps: { x: null, xEdge: null, y: null, yEdge: null },
    };
  }

  const activeEdges = getGroupEdges(movingBounds);

  const { guides: alignGuides, snapDelta, newSnaps } =
    findAlignmentGuides(activeEdges, others, currentSnaps);

  // Spacing: use snapped edges for better accuracy
  const snappedEdges = {
    ...activeEdges,
    left:    activeEdges.left + snapDelta.x,
    right:   activeEdges.right + snapDelta.x,
    centerX: activeEdges.centerX + snapDelta.x,
    top:     activeEdges.top + snapDelta.y,
    bottom:  activeEdges.bottom + snapDelta.y,
    centerY: activeEdges.centerY + snapDelta.y,
  };

  const { guides: spacingGuides, spacingSnap } =
    findSpacingGuides(snappedEdges, others);

  // Combine snap deltas — alignment takes priority
  const finalDelta = { ...snapDelta };
  if (finalDelta.x === 0 && spacingSnap.x !== 0) finalDelta.x = spacingSnap.x;
  if (finalDelta.y === 0 && spacingSnap.y !== 0) finalDelta.y = spacingSnap.y;

  return { alignGuides, spacingGuides, snapDelta: finalDelta, newSnaps };
}
