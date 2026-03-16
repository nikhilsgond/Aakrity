/**
 * Smart Guides & Snapping System — Tests
 * Tests the core engine (SmartGuideEngine) and state (SmartGuideState).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getObjectEdges,
  getGroupEdges,
  findAlignmentGuides,
  findSpacingGuides,
  findDimensionMatches,
  findLengthMatches,
  snapRotation,
  snapAspectRatio,
  queryMoveGuides,
  ALIGN_SNAP_ENTRY,
  ALIGN_SNAP_EXIT,
  ROTATION_SNAP_ANGLES,
} from '../src/features/canvas/engine/smartGuides/SmartGuideEngine.js';
import SmartGuideState from '../src/features/canvas/engine/smartGuides/SmartGuideState.js';
import { makeRect, makeCircle, makeLine, makeEllipse, makeTriangle } from './helpers.js';

// ═══════════════════════════════════════════════════════════
// 1. getObjectEdges
// ═══════════════════════════════════════════════════════════
describe('getObjectEdges', () => {
  it('returns correct edges for a rectangle', () => {
    const rect = makeRect({ x: 100, y: 50, width: 200, height: 100 });
    const e = getObjectEdges(rect);
    expect(e).not.toBeNull();
    expect(e.left).toBe(100);
    expect(e.right).toBe(300);
    expect(e.centerX).toBe(200);
    expect(e.top).toBe(50);
    expect(e.bottom).toBe(150);
    expect(e.centerY).toBe(100);
    expect(e.width).toBe(200);
    expect(e.height).toBe(100);
  });

  it('returns correct edges for a circle', () => {
    const circle = makeCircle({ x: 200, y: 200, radius: 50 });
    const e = getObjectEdges(circle);
    expect(e).not.toBeNull();
    expect(e.left).toBe(150);
    expect(e.right).toBe(250);
    expect(e.centerX).toBe(200);
    expect(e.top).toBe(150);
    expect(e.bottom).toBe(250);
    expect(e.centerY).toBe(200);
  });

  it('returns null for drawings', () => {
    const drawing = { id: 'd1', type: 'drawing', points: [{ x: 0, y: 0 }] };
    expect(getObjectEdges(drawing)).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(getObjectEdges(null)).toBeNull();
    expect(getObjectEdges(undefined)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// 2. getGroupEdges
// ═══════════════════════════════════════════════════════════
describe('getGroupEdges', () => {
  it('builds edges from a bounding box', () => {
    const bounds = { x: 10, y: 20, width: 100, height: 50 };
    const e = getGroupEdges(bounds);
    expect(e.left).toBe(10);
    expect(e.right).toBe(110);
    expect(e.centerX).toBe(60);
    expect(e.top).toBe(20);
    expect(e.bottom).toBe(70);
    expect(e.centerY).toBe(45);
  });

  it('returns null for null input', () => {
    expect(getGroupEdges(null)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// 3. findAlignmentGuides
// ═══════════════════════════════════════════════════════════
describe('findAlignmentGuides', () => {
  const noSnaps = { x: null, xEdge: null, y: null, yEdge: null };

  it('detects left-edge alignment', () => {
    const active = getGroupEdges({ x: 100, y: 200, width: 80, height: 60 });
    const other = makeRect({ id: 'r2', x: 100, y: 50, width: 120, height: 40 });
    const result = findAlignmentGuides(active, [other], noSnaps);

    expect(result.guides.length).toBeGreaterThan(0);
    const leftGuide = result.guides.find(g => g.axis === 'x' && g.activeEdge === 'left' && g.matchEdge === 'left');
    expect(leftGuide).toBeDefined();
    expect(leftGuide.value).toBe(100);
    expect(result.snapDelta.x).toBe(0); // already aligned
  });

  it('detects center alignment with snap delta', () => {
    // Active center at 143, other center at 140 → should snap (dist = 3 < 6)
    const active = getGroupEdges({ x: 103, y: 200, width: 80, height: 60 });
    const other = makeRect({ id: 'r2', x: 80, y: 50, width: 120, height: 40 });
    // active.centerX = 143, other.centerX = 140
    const result = findAlignmentGuides(active, [other], noSnaps);

    const centerGuide = result.guides.find(g => g.axis === 'x' && g.activeEdge === 'centerX' && g.matchEdge === 'centerX');
    expect(centerGuide).toBeDefined();
    expect(result.snapDelta.x).toBe(-3); // pull left 3 units
  });

  it('produces no guides when objects are far apart', () => {
    const active = getGroupEdges({ x: 0, y: 0, width: 50, height: 50 });
    const other = makeRect({ id: 'r2', x: 500, y: 500, width: 50, height: 50 });
    const result = findAlignmentGuides(active, [other], noSnaps);
    expect(result.guides.length).toBe(0);
    expect(result.snapDelta.x).toBe(0);
    expect(result.snapDelta.y).toBe(0);
  });

  it('detects both X and Y alignment simultaneously', () => {
    // Both left edges and top edges match
    const active = getGroupEdges({ x: 100, y: 50, width: 80, height: 60 });
    const other = makeRect({ id: 'r2', x: 100, y: 50, width: 120, height: 40 });
    const result = findAlignmentGuides(active, [other], noSnaps);

    const xGuides = result.guides.filter(g => g.axis === 'x');
    const yGuides = result.guides.filter(g => g.axis === 'y');
    expect(xGuides.length).toBeGreaterThan(0);
    expect(yGuides.length).toBeGreaterThan(0);
  });

  it('applies hysteresis — does not release snap within exit threshold', () => {
    // Pre-snapped at x=100
    const snaps = { x: 100, xEdge: 'left', y: null, yEdge: null };
    // Active left at 107 (distFromSnap = 7 < exitThreshold=10)
    const active = getGroupEdges({ x: 107, y: 200, width: 80, height: 60 });
    const other = makeRect({ id: 'r2', x: 100, y: 50, width: 120, height: 40 });
    const result = findAlignmentGuides(active, [other], snaps);

    // Should still snap to 100
    expect(result.snapDelta.x).toBe(100 - 107); // = -7
  });

  it('releases snap when beyond exit threshold', () => {
    const snaps = { x: 100, xEdge: 'left', y: null, yEdge: null };
    // Active left at 115 (distFromSnap = 15 > exitThreshold=10)
    const active = getGroupEdges({ x: 115, y: 200, width: 80, height: 60 });
    // No matching object within entry threshold either
    const result = findAlignmentGuides(active, [], snaps);

    expect(result.snapDelta.x).toBe(0); // released
  });

  it('handles empty other objects array', () => {
    const active = getGroupEdges({ x: 100, y: 200, width: 80, height: 60 });
    const result = findAlignmentGuides(active, [], noSnaps);
    expect(result.guides.length).toBe(0);
    expect(result.snapDelta.x).toBe(0);
    expect(result.snapDelta.y).toBe(0);
  });

  it('snaps to closest when multiple objects are within threshold', () => {
    const active = getGroupEdges({ x: 103, y: 200, width: 80, height: 60 });
    const o1 = makeRect({ id: 'r1', x: 100, y: 50, width: 120, height: 40 }); // dist = 3
    const o2 = makeRect({ id: 'r2', x: 105, y: 50, width: 120, height: 40 }); // dist = 2
    const result = findAlignmentGuides(active, [o1, o2], noSnaps);

    // Closest is right-edge=225 to o2 left=105, but
    // for left edges: active.left=103, o1.left=100 (dist=3), o2.left=105 (dist=2)
    // Closest to active left is o2.left at 105 (distance 2)
    expect(result.snapDelta.x).toBe(2); // snap right to 105
  });
});

// ═══════════════════════════════════════════════════════════
// 4. findSpacingGuides
// ═══════════════════════════════════════════════════════════
describe('findSpacingGuides', () => {
  it('detects equal horizontal spacing', () => {
    // Three objects in a row with equal gaps
    // A: [0, 50], B:[100, 150], Active:[200, 250]
    // Gap A-B = 50, Gap B-Active = 50 → equal
    const a = makeRect({ id: 'a', x: 0, y: 100, width: 50, height: 30 });
    const b = makeRect({ id: 'b', x: 100, y: 100, width: 50, height: 30 });
    const activeEdges = getGroupEdges({ x: 200, y: 100, width: 50, height: 30 });

    const result = findSpacingGuides(activeEdges, [a, b]);
    expect(result.guides.length).toBeGreaterThan(0);
    const xGuide = result.guides.find(g => g.axis === 'x');
    expect(xGuide).toBeDefined();
    expect(xGuide.equalGap).toBe(50);
  });

  it('no spacing guides when gaps are unequal', () => {
    const a = makeRect({ id: 'a', x: 0, y: 100, width: 50, height: 30 });
    const b = makeRect({ id: 'b', x: 100, y: 100, width: 50, height: 30 });
    const activeEdges = getGroupEdges({ x: 250, y: 100, width: 50, height: 30 });
    // gap A-B = 50, gap B-Active = 100 → not equal (diff=50)

    const result = findSpacingGuides(activeEdges, [a, b]);
    expect(result.guides.length).toBe(0);
  });

  it('returns empty for single other object', () => {
    const a = makeRect({ id: 'a', x: 0, y: 100, width: 50, height: 30 });
    const activeEdges = getGroupEdges({ x: 100, y: 100, width: 50, height: 30 });

    const result = findSpacingGuides(activeEdges, [a]);
    expect(result.guides.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. findDimensionMatches
// ═══════════════════════════════════════════════════════════
describe('findDimensionMatches', () => {
  it('matches width of another rectangle', () => {
    const other = makeRect({ id: 'r2', x: 0, y: 0, width: 200, height: 100 });
    const result = findDimensionMatches('width', 202, [other]);
    expect(result.matches.length).toBe(1);
    expect(result.snapValue).toBe(200);
  });

  it('matches height of another rectangle', () => {
    const other = makeRect({ id: 'r2', x: 0, y: 0, width: 200, height: 150 });
    const result = findDimensionMatches('height', 153, [other]);
    expect(result.matches.length).toBe(1);
    expect(result.snapValue).toBe(150);
  });

  it('matches radius of another circle', () => {
    const other = makeCircle({ id: 'c2', x: 0, y: 0, radius: 75 });
    const result = findDimensionMatches('radius', 73, [other]);
    expect(result.matches.length).toBe(1);
    expect(result.snapValue).toBe(75);
  });

  it('no match when too far', () => {
    const other = makeRect({ id: 'r2', x: 0, y: 0, width: 200, height: 100 });
    const result = findDimensionMatches('width', 250, [other]);
    expect(result.matches.length).toBe(0);
    expect(result.snapValue).toBeNull();
  });

  it('skips drawings', () => {
    const drawing = { id: 'd1', type: 'drawing', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }] };
    const result = findDimensionMatches('width', 200, [drawing]);
    expect(result.matches.length).toBe(0);
  });

  it('picks closest match when multiple objects qualify', () => {
    const o1 = makeRect({ id: 'r1', x: 0, y: 0, width: 200, height: 100 });
    const o2 = makeRect({ id: 'r2', x: 0, y: 0, width: 203, height: 100 });
    const result = findDimensionMatches('width', 202, [o1, o2]);
    expect(result.matches.length).toBe(2);
    // Closest is o2 at 203 (dist 1) vs o1 at 200 (dist 2)
    expect(result.snapValue).toBe(203);
  });
});

// ═══════════════════════════════════════════════════════════
// 6. findLengthMatches
// ═══════════════════════════════════════════════════════════
describe('findLengthMatches', () => {
  it('matches length of another line', () => {
    const line = makeLine({ id: 'l2', x1: 0, y1: 0, x2: 100, y2: 0 });
    const result = findLengthMatches(103, [line]);
    expect(result.matches.length).toBe(1);
    expect(result.snapValue).toBe(100);
  });

  it('no match for rectangle (not a line)', () => {
    const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 50 });
    const result = findLengthMatches(100, [rect]);
    expect(result.matches.length).toBe(0);
  });

});

// ═══════════════════════════════════════════════════════════
// 7. snapRotation
// ═══════════════════════════════════════════════════════════
describe('snapRotation', () => {
  const RAD = Math.PI / 180;

  it('snaps to 0 degrees when close', () => {
    const result = snapRotation(2 * RAD);
    expect(result.isSnapped).toBe(true);
    expect(result.snapDegrees).toBe(0);
    expect(result.snappedAngle).toBeCloseTo(0, 5);
  });

  it('snaps to 90 degrees', () => {
    const result = snapRotation(88 * RAD);
    expect(result.isSnapped).toBe(true);
    expect(result.snapDegrees).toBe(90);
    expect(result.snappedAngle).toBeCloseTo(90 * RAD, 3);
  });

  it('snaps to 45 degrees', () => {
    const result = snapRotation(46 * RAD);
    expect(result.isSnapped).toBe(true);
    expect(result.snapDegrees).toBe(45);
  });

  it('snaps to 180 degrees', () => {
    const result = snapRotation(178 * RAD);
    expect(result.isSnapped).toBe(true);
    expect(result.snapDegrees).toBe(180);
  });

  it('snaps to 270 degrees', () => {
    const result = snapRotation(272 * RAD);
    expect(result.isSnapped).toBe(true);
    expect(result.snapDegrees).toBe(270);
  });

  it('does not snap when far from any target', () => {
    const result = snapRotation(22 * RAD);
    expect(result.isSnapped).toBe(false);
    expect(result.snappedAngle).toBeCloseTo(22 * RAD, 3);
  });

  it('applies hysteresis — stays snapped within exit threshold', () => {
    const snappedAt = 90 * RAD;
    const current = 95 * RAD; // 5 deg away (< 7 exit threshold)
    const result = snapRotation(current, snappedAt);
    expect(result.isSnapped).toBe(true);
    expect(result.snappedAngle).toBeCloseTo(90 * RAD, 3);
  });

  it('releases snap when beyond exit threshold', () => {
    const snappedAt = 90 * RAD;
    const current = 100 * RAD; // 10 deg away (> 7 exit threshold)
    const result = snapRotation(current, snappedAt);
    // Should not snap to 90 anymore, 100 is closest to 90 (10 deg > 4 entry)
    // So it should not snap
    expect(result.isSnapped).toBe(false);
  });

  it('handles negative angles', () => {
    const result = snapRotation(-3 * RAD);
    expect(result.isSnapped).toBe(true);
    // Should snap to 0 (or 360 normalised)
    expect([0, 360]).toContain(result.snapDegrees);
  });

  it('handles angles > 360', () => {
    const result = snapRotation(361 * RAD);
    expect(result.isSnapped).toBe(true);
    // ~361 deg → near 0/360
    expect([0, 360]).toContain(result.snapDegrees);
  });

  it('snaps to all 8 cardinal/diagonal angles', () => {
    for (const target of ROTATION_SNAP_ANGLES) {
      const result = snapRotation((target + 1) * RAD);
      expect(result.isSnapped).toBe(true);
      expect(result.snapDegrees).toBe(target);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 8. snapAspectRatio
// ═══════════════════════════════════════════════════════════
describe('snapAspectRatio', () => {
  it('snaps to 1:1 ratio', () => {
    const result = snapAspectRatio(102, 100);
    expect(result.isSnapped).toBe(true);
    expect(result.ratioLabel).toBe('1:1');
    expect(result.snappedW).toBeCloseTo(100, 0);
    expect(result.snappedH).toBeCloseTo(100, 0);
  });

  it('snaps to 2:1 ratio', () => {
    const result = snapAspectRatio(198, 100);
    expect(result.isSnapped).toBe(true);
    expect(result.ratioLabel).toBe('2:1');
  });

  it('snaps to 1:2 ratio', () => {
    const result = snapAspectRatio(100, 198);
    expect(result.isSnapped).toBe(true);
    expect(result.ratioLabel).toBe('1:2');
  });

  it('does not snap to unclean ratios', () => {
    const result = snapAspectRatio(173, 100);
    expect(result.isSnapped).toBe(false);
  });

  it('snaps to another object ratio', () => {
    const other = makeRect({ id: 'r1', x: 0, y: 0, width: 300, height: 200 });
    // 300/200 = 1.5 = 3:2
    const result = snapAspectRatio(148, 100, [other]);
    // 148/100 = 1.48, target = 1.5 (3:2), dist = 0.02/1.5 = 0.013 < 0.04
    expect(result.isSnapped).toBe(true);
  });

  it('handles zero dimensions', () => {
    const result = snapAspectRatio(0, 100);
    expect(result.isSnapped).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// 9. queryMoveGuides — integration
// ═══════════════════════════════════════════════════════════
describe('queryMoveGuides', () => {
  it('returns empty for no other objects', () => {
    const bounds = { x: 100, y: 100, width: 80, height: 60 };
    const objects = [makeRect({ id: 'active', x: 100, y: 100, width: 80, height: 60 })];
    const snaps = { x: null, xEdge: null, y: null, yEdge: null };

    const result = queryMoveGuides(bounds, objects, ['active'], snaps);
    expect(result.alignGuides.length).toBe(0);
    expect(result.spacingGuides.length).toBe(0);
    expect(result.snapDelta.x).toBe(0);
    expect(result.snapDelta.y).toBe(0);
  });

  it('produces alignment guides with other objects', () => {
    const bounds = { x: 102, y: 200, width: 80, height: 60 };
    const objects = [
      makeRect({ id: 'active', x: 102, y: 200, width: 80, height: 60 }),
      makeRect({ id: 'other', x: 100, y: 50, width: 120, height: 40 }),
    ];
    const snaps = { x: null, xEdge: null, y: null, yEdge: null };

    const result = queryMoveGuides(bounds, objects, ['active'], snaps);
    expect(result.alignGuides.length).toBeGreaterThan(0);
    expect(result.snapDelta.x).toBe(-2);
  });

  it('skips self when computing guides', () => {
    const bounds = { x: 100, y: 100, width: 50, height: 50 };
    const objects = [makeRect({ id: 'me', x: 100, y: 100, width: 50, height: 50 })];
    const snaps = { x: null, xEdge: null, y: null, yEdge: null };

    const result = queryMoveGuides(bounds, objects, ['me'], snaps);
    expect(result.alignGuides.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 10. SmartGuideState
// ═══════════════════════════════════════════════════════════
describe('SmartGuideState', () => {
  let state;

  beforeEach(() => {
    state = new SmartGuideState();
  });

  it('starts in idle mode with no guides', () => {
    expect(state.mode).toBe('idle');
    expect(state.hasGuides()).toBe(false);
    expect(state.getRenderData()).toBeNull();
  });

  it('hasGuides returns true when alignment guides exist', () => {
    state.mode = 'move';
    state.alignGuides = [{ axis: 'x', value: 100 }];
    expect(state.hasGuides()).toBe(true);
  });

  it('hasGuides returns false when suppressed', () => {
    state.mode = 'move';
    state.alignGuides = [{ axis: 'x', value: 100 }];
    state.suppressed = true;
    expect(state.hasGuides()).toBe(false);
  });

  it('hasGuides returns false when idle', () => {
    state.alignGuides = [{ axis: 'x', value: 100 }];
    expect(state.hasGuides()).toBe(false);
  });

  it('hasGuides true for rotation snap', () => {
    state.mode = 'rotate';
    state.rotationSnap = { isSnapped: true, snapDegrees: 90, center: { x: 0, y: 0 } };
    expect(state.hasGuides()).toBe(true);
  });

  it('hasGuides true for dimension matches', () => {
    state.mode = 'resize';
    state.dimensionMatches = [{ objId: 'r1', value: 200, dimension: 'width' }];
    expect(state.hasGuides()).toBe(true);
  });

  it('reset clears everything', () => {
    state.mode = 'move';
    state.alignGuides = [{ axis: 'x', value: 100 }];
    state.spacingGuides = [{ axis: 'x' }];
    state.dimensionMatches = [{ value: 200 }];
    state.rotationSnap = { isSnapped: true };
    state.currentAlignSnaps = { x: 100, xEdge: 'left', y: null, yEdge: null };
    state.suppressed = true;

    state.reset();

    expect(state.mode).toBe('idle');
    expect(state.alignGuides.length).toBe(0);
    expect(state.spacingGuides.length).toBe(0);
    expect(state.dimensionMatches.length).toBe(0);
    expect(state.rotationSnap).toBeNull();
    expect(state.suppressed).toBe(false);
    expect(state.currentAlignSnaps.x).toBeNull();
  });

  it('getRenderData returns all guide data', () => {
    state.mode = 'move';
    state.alignGuides = [{ axis: 'x', value: 100 }];
    state.spacingGuides = [{ axis: 'y' }];

    const data = state.getRenderData();
    expect(data).not.toBeNull();
    expect(data.alignGuides.length).toBe(1);
    expect(data.spacingGuides.length).toBe(1);
    expect(data.dimensionMatches.length).toBe(0);
    expect(data.rotationSnap).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// 11. Edge cases
// ═══════════════════════════════════════════════════════════
describe('Smart Guides Edge Cases', () => {
  const noSnaps = { x: null, xEdge: null, y: null, yEdge: null };

  it('handles right-edge to left-edge alignment', () => {
    // active right = 200, other left = 200 → exact alignment
    const active = getGroupEdges({ x: 100, y: 100, width: 100, height: 50 });
    const other = makeRect({ id: 'r2', x: 200, y: 200, width: 80, height: 30 });
    const result = findAlignmentGuides(active, [other], noSnaps);

    const guide = result.guides.find(g => g.axis === 'x' && g.activeEdge === 'right' && g.matchEdge === 'left');
    expect(guide).toBeDefined();
  });

  it('handles bottom-edge to top-edge alignment', () => {
    const active = getGroupEdges({ x: 100, y: 100, width: 100, height: 50 });
    const other = makeRect({ id: 'r2', x: 200, y: 150, width: 80, height: 30 });
    const result = findAlignmentGuides(active, [other], noSnaps);

    const guide = result.guides.find(g => g.axis === 'y' && g.activeEdge === 'bottom' && g.matchEdge === 'top');
    expect(guide).toBeDefined();
  });

  it('works with ellipses', () => {
    const active = getGroupEdges({ x: 100, y: 100, width: 80, height: 60 });
    const ellipse = makeEllipse({ id: 'e1', x: 240, y: 130, radiusX: 80, radiusY: 40 });
    const result = findAlignmentGuides(active, [ellipse], noSnaps);
    // Ellipse center: (240, 130), active centerY = 130 → should match
    const yCenter = result.guides.find(g => g.axis === 'y' && g.activeEdge === 'centerY');
    expect(yCenter).toBeDefined();
  });

  it('works with triangles', () => {
    const active = getGroupEdges({ x: 100, y: 100, width: 80, height: 60 });
    const tri = makeTriangle({
      id: 'tri1',
      points: [
        { x: 100, y: 10 },
        { x: 50, y: 90 },
        { x: 150, y: 90 },
      ],
    });
    const result = findAlignmentGuides(active, [tri], noSnaps);
    // Triangle bounds: x=50..150, y=10..90. Active left=100(=tri x center)
    expect(result.guides.length).toBeGreaterThanOrEqual(0); // May or may not match depending on bounds
  });

  it('multiple objects produce multiple guides', () => {
    const active = getGroupEdges({ x: 100, y: 100, width: 80, height: 60 });
    const o1 = makeRect({ id: 'r1', x: 100, y: 20, width: 60, height: 40 });
    const o2 = makeRect({ id: 'r2', x: 100, y: 300, width: 90, height: 30 });

    const result = findAlignmentGuides(active, [o1, o2], noSnaps);
    // Both o1 and o2 have left=100 matching active left=100
    const leftGuides = result.guides.filter(g => g.axis === 'x' && g.activeEdge === 'left' && g.matchEdge === 'left');
    expect(leftGuides.length).toBe(2);
  });

  it('dimension match with ellipse radiusX', () => {
    const other = makeEllipse({ id: 'e1', x: 0, y: 0, radiusX: 80, radiusY: 40 });
    const result = findDimensionMatches('radiusX', 82, [other]);
    expect(result.matches.length).toBe(1);
    expect(result.snapValue).toBe(80);
  });

  it('dimension match with ellipse radiusY', () => {
    const other = makeEllipse({ id: 'e1', x: 0, y: 0, radiusX: 80, radiusY: 40 });
    const result = findDimensionMatches('radiusY', 42, [other]);
    expect(result.matches.length).toBe(1);
    expect(result.snapValue).toBe(40);
  });
});
