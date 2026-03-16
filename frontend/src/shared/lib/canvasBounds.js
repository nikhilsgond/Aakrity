/**
 * Shared bounds checking for ALL commands
 */
export const Bounds = {
  // Canvas limits (could come from config)
  MIN_X: -500000,
  MAX_X: 500000,
  MIN_Y: -500000,
  MAX_Y: 500000,

  // Clamp a single point
  clampPoint(x, y) {
    return {
      x: Math.max(this.MIN_X, Math.min(this.MAX_X, x)),
      y: Math.max(this.MIN_Y, Math.min(this.MAX_Y, y))
    };
  },

  // Clamp an object's position (considering size)
  clampObject(obj) {
    const halfWidth = (obj.width || 0) / 2;
    const halfHeight = (obj.height || 0) / 2;
    
    return {
      x: Math.max(this.MIN_X + halfWidth, Math.min(this.MAX_X - halfWidth, obj.x)),
      y: Math.max(this.MIN_Y + halfHeight, Math.min(this.MAX_Y - halfHeight, obj.y))
    };
  },

  // Clamp a point array (for pencil drawings)
  clampPoints(points) {
    return points.map(p => ({
      x: Math.max(this.MIN_X, Math.min(this.MAX_X, p.x)),
      y: Math.max(this.MIN_Y, Math.min(this.MAX_Y, p.y))
    }));
  },

  // Check if object is within bounds
  isWithinBounds(obj) {
    const clamped = this.clampObject(obj);
    return clamped.x === obj.x && clamped.y === obj.y;
  }
};