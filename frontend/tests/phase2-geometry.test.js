/**
 * Phase 2 — Geometry Tests
 *
 * Bounding box calculation
 * Hit detection accuracy
 * Handle positions correct
 * World ↔ screen transform correct
 * Rotation math stable
 */

import { describe, it, expect } from 'vitest';
import ObjectGeometry from '../src/features/canvas/engine/geometry/ObjectGeometry.js';
import { computeOBBFromRect, boundsIntersect, getBoundsFromPoints, pointNearLineSegment } from '../src/features/canvas/engine/geometry/helpers/geometryShared.js';
import { getHandleWorldX, getHandleWorldY, worldDeltaToLocal, getScaleX, getScaleY } from '../src/features/canvas/engine/transform/transformMath.js';

/* ================================================================
   Bounding Box Calculations
   ================================================================ */
describe('Phase 2 — Bounding Box Calculations', () => {
  it('rectangle getBounds returns correct axis-aligned bounds', () => {
    const rect = { type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
    const bounds = ObjectGeometry.getBounds(rect);
    expect(bounds).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('rectangle getBounds handles negative width/height', () => {
    const rect = { type: 'rectangle', x: 110, y: 70, width: -100, height: -50 };
    const bounds = ObjectGeometry.getBounds(rect);
    expect(bounds).not.toBeNull();
    expect(bounds.width).toBe(100);
    expect(bounds.height).toBe(50);
  });

  it('rectangle getBounds with rotation returns expanded AABB', () => {
    const rect = { type: 'rectangle', x: 0, y: 0, width: 100, height: 0, rotation: Math.PI / 4 };
    const bounds = ObjectGeometry.getBounds(rect);
    expect(bounds).not.toBeNull();
    // A 100-wide horizontal line rotated 45° should have equal width and height
    expect(bounds.width).toBeCloseTo(bounds.height, 0);
  });

  it('circle getBounds returns correct bounds', () => {
    const circle = { type: 'circle', x: 50, y: 50, radius: 25 };
    const bounds = ObjectGeometry.getBounds(circle);
    expect(bounds).toEqual({ x: 25, y: 25, width: 50, height: 50 });
  });

  it('line getBounds returns correct bounds', () => {
    const line = { type: 'line', x1: 10, y1: 20, x2: 110, y2: 120 };
    const bounds = ObjectGeometry.getBounds(line);
    expect(bounds).toEqual({ x: 10, y: 20, width: 100, height: 100 });
  });

  it('ellipse getBounds delegates to handler', () => {
    const ellipse = { type: 'ellipse', x: 100, y: 100, radiusX: 50, radiusY: 30 };
    const bounds = ObjectGeometry.getBounds(ellipse);
    expect(bounds).not.toBeNull();
  });

  it('triangle getBounds from points', () => {
    const tri = {
      type: 'triangle',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 80 },
      ],
    };
    const bounds = ObjectGeometry.getBounds(tri);
    expect(bounds).toEqual({ x: 0, y: 0, width: 100, height: 80 });
  });

  it('drawing getBounds from points with stroke padding', () => {
    const drawing = {
      type: 'drawing',
      points: [{ x: 10, y: 10 }, { x: 50, y: 50 }],
      strokeWidth: 4,
    };
    const bounds = ObjectGeometry.getBounds(drawing);
    expect(bounds).not.toBeNull();
    // Should include stroke padding
    expect(bounds.x).toBeLessThan(10);
  });

  it('getBounds returns null for unknown type', () => {
    const unknown = { type: 'alien_shape', x: 0, y: 0 };
    const bounds = ObjectGeometry.getBounds(unknown);
    expect(bounds).toBeNull();
  });

  it('getBounds returns null for null object', () => {
    const bounds = ObjectGeometry.getBounds(null);
    expect(bounds).toBeNull();
  });

  it('getBoundsFromPoints works correctly', () => {
    const points = [
      { x: 5, y: 10 },
      { x: 50, y: 3 },
      { x: 25, y: 60 },
    ];
    const bounds = getBoundsFromPoints(points);
    expect(bounds).toEqual({ x: 5, y: 3, width: 45, height: 57 });
  });

  it('getBoundsFromPoints returns null for empty array', () => {
    expect(getBoundsFromPoints([])).toBeNull();
  });
});

/* ================================================================
   Hit Detection
   ================================================================ */
describe('Phase 2 — Hit Detection', () => {
  it('rectangle hitTest detects point inside', () => {
    const rect = { type: 'rectangle', x: 0, y: 0, width: 100, height: 100 };
    expect(ObjectGeometry.hitTest({ x: 50, y: 50 }, rect)).toBe(true);
  });

  it('rectangle hitTest rejects point outside', () => {
    const rect = { type: 'rectangle', x: 0, y: 0, width: 100, height: 100 };
    expect(ObjectGeometry.hitTest({ x: 200, y: 200 }, rect)).toBe(false);
  });

  it('rectangle hitTest with tolerance accepts point near edge', () => {
    const rect = { type: 'rectangle', x: 0, y: 0, width: 100, height: 100 };
    expect(ObjectGeometry.hitTest({ x: 102, y: 50 }, rect, 5)).toBe(true);
  });

  it('rotated rectangle hitTest works correctly', () => {
    const rect = {
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      rotation: Math.PI / 2, // 90°
    };
    // After 90° rotation around center (50,10), the rectangle becomes vertical
    // Center is at (50, 10), rotated to be 20 wide and 100 tall
    // Point (50, 50) should be inside
    expect(ObjectGeometry.hitTest({ x: 50, y: 50 }, rect)).toBe(true);
  });

  it('circle hitTest detects point inside', () => {
    const circle = { type: 'circle', x: 50, y: 50, radius: 30 };
    expect(ObjectGeometry.hitTest({ x: 50, y: 50 }, circle)).toBe(true);
    expect(ObjectGeometry.hitTest({ x: 55, y: 55 }, circle)).toBe(true);
  });

  it('circle hitTest rejects point outside', () => {
    const circle = { type: 'circle', x: 50, y: 50, radius: 30 };
    expect(ObjectGeometry.hitTest({ x: 200, y: 200 }, circle)).toBe(false);
  });

  it('line hitTest detects point near line', () => {
    const lineObj = { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 };
    expect(ObjectGeometry.hitTest({ x: 50, y: 0 }, lineObj, 5)).toBe(true);
    expect(ObjectGeometry.hitTest({ x: 50, y: 3 }, lineObj, 5)).toBe(true);
  });

  it('line hitTest rejects distant point', () => {
    const lineObj = { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 };
    expect(ObjectGeometry.hitTest({ x: 50, y: 50 }, lineObj, 5)).toBe(false);
  });

  it('triangle hitTest inside', () => {
    const tri = {
      type: 'triangle',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ],
    };
    expect(ObjectGeometry.hitTest({ x: 50, y: 30 }, tri, 0)).toBe(true);
  });

  it('triangle hitTest outside', () => {
    const tri = {
      type: 'triangle',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ],
    };
    expect(ObjectGeometry.hitTest({ x: 200, y: 200 }, tri, 0)).toBe(false);
  });

  it('drawing hitTest near a segment', () => {
    const drawing = {
      type: 'drawing',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      strokeWidth: 2,
    };
    expect(ObjectGeometry.hitTest({ x: 50, y: 0 }, drawing, 5)).toBe(true);
    expect(ObjectGeometry.hitTest({ x: 50, y: 50 }, drawing, 2)).toBe(false);
  });

  it('hitTest returns false for null input', () => {
    expect(ObjectGeometry.hitTest(null, { type: 'rectangle' })).toBe(false);
    expect(ObjectGeometry.hitTest({ x: 0, y: 0 }, null)).toBe(false);
  });

  it('pointNearLineSegment detects near point', () => {
    expect(pointNearLineSegment({ x: 50, y: 2 }, { x1: 0, y1: 0, x2: 100, y2: 0 }, 5)).toBe(true);
  });

  it('pointNearLineSegment zero-length line', () => {
    expect(pointNearLineSegment({ x: 0, y: 0 }, { x1: 0, y1: 0, x2: 0, y2: 0 }, 5)).toBe(true);
    expect(pointNearLineSegment({ x: 10, y: 10 }, { x1: 0, y1: 0, x2: 0, y2: 0 }, 5)).toBe(false);
  });
});

/* ================================================================
   Intersects Rect
   ================================================================ */
describe('Phase 2 — Rect Intersection', () => {
  it('boundsIntersect detects overlap', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 50, y: 50, width: 100, height: 100 };
    expect(boundsIntersect(a, b)).toBe(true);
  });

  it('boundsIntersect detects non-overlap', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 200, y: 200, width: 100, height: 100 };
    expect(boundsIntersect(a, b)).toBe(false);
  });

  it('rectangle intersectsRect works', () => {
    const rect = { type: 'rectangle', x: 10, y: 10, width: 50, height: 50 };
    expect(ObjectGeometry.intersectsRect(rect, { x: 0, y: 0, width: 100, height: 100 })).toBe(true);
    expect(ObjectGeometry.intersectsRect(rect, { x: 200, y: 200, width: 10, height: 10 })).toBe(false);
  });

  it('circle intersectsRect works', () => {
    const circle = { type: 'circle', x: 50, y: 50, radius: 25 };
    expect(ObjectGeometry.intersectsRect(circle, { x: 0, y: 0, width: 100, height: 100 })).toBe(true);
    expect(ObjectGeometry.intersectsRect(circle, { x: 200, y: 200, width: 10, height: 10 })).toBe(false);
  });
});

/* ================================================================
   OBB (Oriented Bounding Box)
   ================================================================ */
describe('Phase 2 — OBB Computation', () => {
  it('computeOBBFromRect without rotation returns axis-aligned corners', () => {
    const obj = { x: 10, y: 20, width: 100, height: 50, rotation: 0 };
    const obb = computeOBBFromRect(obj);
    expect(obb.corners).toHaveLength(4);
    expect(obb.center).toEqual({ x: 60, y: 45 });
    expect(obb.corners[0]).toEqual({ x: 10, y: 20 });
    expect(obb.corners[2]).toEqual({ x: 110, y: 70 });
  });

  it('computeOBBFromRect with rotation returns rotated corners', () => {
    const obj = { x: 0, y: 0, width: 100, height: 0, rotation: Math.PI / 2 };
    const obb = computeOBBFromRect(obj);
    // Center at (50, 0), 90° rotation
    expect(obb.center.x).toBeCloseTo(50);
    expect(obb.center.y).toBeCloseTo(0);
    // Corners should be rotated
    expect(obb.corners[0].x).toBeCloseTo(50);
    expect(obb.corners[0].y).toBeCloseTo(-50);
  });

  it('ObjectGeometry.getOBB for rectangle', () => {
    const rect = { type: 'rectangle', x: 0, y: 0, width: 100, height: 100, rotation: 0 };
    const obb = ObjectGeometry.getOBB(rect);
    expect(obb).not.toBeNull();
    expect(obb.corners).toHaveLength(4);
  });

  it('ObjectGeometry.getOBB for text', () => {
    const text = { type: 'text', x: 0, y: 0, width: 200, height: 50, rotation: 0 };
    const obb = ObjectGeometry.getOBB(text);
    expect(obb).not.toBeNull();
    expect(obb.corners).toHaveLength(4);
  });
});

/* ================================================================
   Transform Math — Handle Positions
   ================================================================ */
describe('Phase 2 — Transform Handle Positions', () => {
  const bounds = { x: 0, y: 0, width: 100, height: 80 };

  it('getHandleWorldX top-left', () => {
    expect(getHandleWorldX('tl', bounds)).toBe(0);
    expect(getHandleWorldX('nw', bounds)).toBe(0);
  });

  it('getHandleWorldX top-right', () => {
    expect(getHandleWorldX('tr', bounds)).toBe(100);
    expect(getHandleWorldX('ne', bounds)).toBe(100);
  });

  it('getHandleWorldX center handles', () => {
    expect(getHandleWorldX('t', bounds)).toBe(50);
    expect(getHandleWorldX('b', bounds)).toBe(50);
  });

  it('getHandleWorldY top handles', () => {
    expect(getHandleWorldY('tl', bounds)).toBe(0);
    expect(getHandleWorldY('tr', bounds)).toBe(0);
  });

  it('getHandleWorldY bottom handles', () => {
    expect(getHandleWorldY('bl', bounds)).toBe(80);
    expect(getHandleWorldY('br', bounds)).toBe(80);
  });

  it('getHandleWorldY side handles at midpoint', () => {
    expect(getHandleWorldY('l', bounds)).toBe(40);
    expect(getHandleWorldY('r', bounds)).toBe(40);
  });
});

/* ================================================================
   Transform Math — World ↔ Local
   ================================================================ */
describe('Phase 2 — World/Local Transforms', () => {
  it('worldDeltaToLocal with no rotation returns same delta', () => {
    const result = worldDeltaToLocal(10, 20, 0);
    expect(result.dx).toBeCloseTo(10);
    expect(result.dy).toBeCloseTo(20);
  });

  it('worldDeltaToLocal with 90° rotation swaps axes', () => {
    const result = worldDeltaToLocal(10, 0, Math.PI / 2);
    expect(result.dx).toBeCloseTo(0);
    // Inverse rotation of (10,0) by 90°: cos(-90°)=0, sin(-90°)=-1
    // dy = 10 * sin(-π/2) + 0 * cos(-π/2) = -10
    expect(result.dy).toBeCloseTo(-10);
  });

  it('worldDeltaToLocal with 180° rotation negates both', () => {
    const result = worldDeltaToLocal(10, 20, Math.PI);
    expect(result.dx).toBeCloseTo(-10);
    expect(result.dy).toBeCloseTo(-20);
  });
});

/* ================================================================
   Transform Math — Scale Computation
   ================================================================ */
describe('Phase 2 — Scale Computation', () => {
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  it('getScaleX for right-side handle', () => {
    expect(getScaleX(50, bounds, 'tr')).toBeCloseTo(1.5);
  });

  it('getScaleX for left-side handle', () => {
    expect(getScaleX(50, bounds, 'tl')).toBeCloseTo(0.5);
  });

  it('getScaleY for bottom handle', () => {
    expect(getScaleY(50, bounds, 'bl')).toBeCloseTo(1.5);
  });

  it('getScaleY for top handle', () => {
    expect(getScaleY(50, bounds, 'tl')).toBeCloseTo(0.5);
  });

  it('getScaleX returns 1 for non-x handles', () => {
    expect(getScaleX(50, bounds, 't')).toBe(1);
    expect(getScaleX(50, bounds, 'b')).toBe(1);
  });

  it('getScaleY returns 1 for non-y handles', () => {
    expect(getScaleY(50, bounds, 'l')).toBe(1);
    expect(getScaleY(50, bounds, 'r')).toBe(1);
  });
});

/* ================================================================
   Rotation Math Stability
   ================================================================ */
describe('Phase 2 — Rotation Math Stability', () => {
  it('OBB corners sum to correct center after rotation', () => {
    const obj = { x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 3 };
    const obb = computeOBBFromRect(obj);
    const avgX = obb.corners.reduce((s, c) => s + c.x, 0) / 4;
    const avgY = obb.corners.reduce((s, c) => s + c.y, 0) / 4;
    expect(avgX).toBeCloseTo(obb.center.x);
    expect(avgY).toBeCloseTo(obb.center.y);
  });

  it('OBB preserves side lengths after rotation', () => {
    const obj = { x: 0, y: 0, width: 100, height: 60, rotation: 1.2 };
    const obb = computeOBBFromRect(obj);
    const side1 = Math.hypot(
      obb.corners[1].x - obb.corners[0].x,
      obb.corners[1].y - obb.corners[0].y
    );
    const side2 = Math.hypot(
      obb.corners[3].x - obb.corners[0].x,
      obb.corners[3].y - obb.corners[0].y
    );
    expect(side1).toBeCloseTo(100);
    expect(side2).toBeCloseTo(60);
  });

  it('360° rotation returns to original position', () => {
    const obj = { x: 10, y: 20, width: 100, height: 50, rotation: 0 };
    const obb0 = computeOBBFromRect(obj);
    obj.rotation = 2 * Math.PI;
    const obb360 = computeOBBFromRect(obj);
    obb0.corners.forEach((c, i) => {
      expect(c.x).toBeCloseTo(obb360.corners[i].x);
      expect(c.y).toBeCloseTo(obb360.corners[i].y);
    });
  });
});
