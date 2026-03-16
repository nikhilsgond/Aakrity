import { BaseCommand } from '../history/BaseCommand.js';

export class RotateCommand extends BaseCommand {
    constructor(objectIds, angle, origin, isOBB = false) {
        super();
        this.objectIds = [...objectIds];
        this.angle = angle; // TOTAL angle (not incremental)
        this.origin = { ...origin };
        this.isOBB = isOBB
        this.initialStates = null; // Snapshots of original geometry
        this.operation = 'rotate';
    }

    execute(state) {
        if (!this.initialStates) {
            this.initialStates = new Map();
        }

        // 🔴 NEW: Get bounds from state
        const bounds = state.canvasBounds;
        let rotated = false;

        this.objectIds.forEach(id => {
            const obj = state.objects.find(o => o.id === id);
            if (!obj) return;

            // CRITICAL: Take snapshot ONLY ONCE
            if (!this.initialStates.has(id)) {
                this.initialStates.set(id, this.getGeometry(obj));
            }

            // 🔴 NEW: Pass bounds to rotation function
            this.rotateObject(obj, id, this.angle, this.origin, bounds);
            rotated = true;
        });

        return rotated;
    }

    undo(state) {
        if (!this.initialStates) return false;

        let reverted = false;

        this.objectIds.forEach(id => {
            const obj = state.objects.find(o => o.id === id);
            if (!obj) return;

            const original = this.initialStates.get(id);
            if (original) {
                this.setGeometry(obj, original);
                reverted = true;
            }
        });

        return reverted;
    }

    getGeometry(obj) {
        switch (obj.type) {
            case 'rectangle':
            case 'text':
            case 'roundedRectangle':
            case 'image':
                return {
                    x: obj.x,
                    y: obj.y,
                    width: obj.width,
                    height: obj.height,
                    rotation: obj.rotation || 0,
                    type: obj.type
                };
            case 'ellipse':
                return {
                    x: obj.x,
                    y: obj.y,
                    radiusX: obj.radiusX,
                    radiusY: obj.radiusY,
                    rotation: obj.rotation || 0,
                    type: obj.type
                };
            case 'circle':
                return {
                    x: obj.x,
                    y: obj.y,
                    radius: obj.radius,
                    type: obj.type
                };
            case 'line':
            case 'arrow':
                return {
                    x1: obj.x1,
                    y1: obj.y1,
                    x2: obj.x2,
                    y2: obj.y2,
                    type: obj.type
                };
            case 'drawing':
            case 'triangle':
            case 'polygon':
                return {
                    points: (obj.points || []).map(p => ({ ...p })),
                    type: obj.type
                };
            default:
                return { type: obj.type };
        }
    }

    setGeometry(obj, geometry) {
        switch (obj.type) {
            case 'rectangle':
            case 'text':
            case 'roundedRectangle':
            case 'image':
                obj.x = geometry.x;
                obj.y = geometry.y;
                obj.width = geometry.width;
                obj.height = geometry.height;
                obj.rotation = geometry.rotation;
                break;
            case 'ellipse':
                obj.x = geometry.x;
                obj.y = geometry.y;
                obj.radiusX = geometry.radiusX;
                obj.radiusY = geometry.radiusY;
                obj.rotation = geometry.rotation;
                break;
            case 'circle':
                obj.x = geometry.x;
                obj.y = geometry.y;
                obj.radius = geometry.radius;
                break;
            case 'line':
            case 'arrow':
                obj.x1 = geometry.x1;
                obj.y1 = geometry.y1;
                obj.x2 = geometry.x2;
                obj.y2 = geometry.y2;
                break;
            case 'drawing':
            case 'triangle':
            case 'polygon':
                obj.points = (geometry.points || []).map(p => ({ ...p }));
                break;
        }
    }

    /**
     * 🔴 NEW: Helper to clamp a value between min and max
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * 🔴 NEW: Calculate bounding box of rotated rectangle
     */
    getRotatedBounds(x, y, width, height, rotation, originX, originY) {
        // Get the four corners relative to rotation origin
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        const corners = [
            { x: x, y: y },
            { x: x + width, y: y },
            { x: x + width, y: y + height },
            { x: x, y: y + height }
        ].map(p => {
            // Translate to origin, rotate, translate back
            const dx = p.x - originX;
            const dy = p.y - originY;
            return {
                x: originX + dx * cos - dy * sin,
                y: originY + dx * sin + dy * cos
            };
        });

        // Find min/max of rotated corners
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        corners.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });

        return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }

    /**
     * 🔴 NEW: Check if rotated object stays within bounds, adjust if needed
     */
    ensureWithinBounds(obj, original, totalAngle, origin, bounds) {
        if (!bounds) return true;

        const { minX, maxX, minY, maxY } = bounds;

        switch (obj.type) {
            case 'rectangle':
            case 'text':
            case 'roundedRectangle':
            case 'image': {
                // Calculate rotated bounds
                const rotatedBounds = this.getRotatedBounds(
                    original.x, original.y,
                    original.width, original.height,
                    totalAngle,
                    origin.x, origin.y
                );

                // Check if any part is outside
                if (rotatedBounds.minX < minX || rotatedBounds.maxX > maxX ||
                    rotatedBounds.minY < minY || rotatedBounds.maxY > maxY) {
                    
                    // Try to shift the object back into bounds
                    const shiftX = Math.max(0, minX - rotatedBounds.minX) - 
                                   Math.max(0, rotatedBounds.maxX - maxX);
                    const shiftY = Math.max(0, minY - rotatedBounds.minY) - 
                                   Math.max(0, rotatedBounds.maxY - maxY);
                    
                    obj.x += shiftX;
                    obj.y += shiftY;
                    
                    // Re-check after shift
                    const finalBounds = this.getRotatedBounds(
                        obj.x, obj.y, obj.width, obj.height,
                        obj.rotation || 0,
                        origin.x, origin.y
                    );
                    
                    return finalBounds.minX >= minX && finalBounds.maxX <= maxX &&
                           finalBounds.minY >= minY && finalBounds.maxY <= maxY;
                }
                return true;
            }

            case 'ellipse': {
                // For ellipse, check if center is within bounds with radius considered
                const radiusX = obj.radiusX || original.radiusX;
                const radiusY = obj.radiusY || original.radiusY;
                
                if (obj.x - radiusX < minX || obj.x + radiusX > maxX ||
                    obj.y - radiusY < minY || obj.y + radiusY > maxY) {
                    
                    obj.x = this.clamp(obj.x, minX + radiusX, maxX - radiusX);
                    obj.y = this.clamp(obj.y, minY + radiusY, maxY - radiusY);
                }
                return true;
            }

            case 'circle': {
                const radius = obj.radius || original.radius;
                if (obj.x - radius < minX || obj.x + radius > maxX ||
                    obj.y - radius < minY || obj.y + radius > maxY) {
                    
                    obj.x = this.clamp(obj.x, minX + radius, maxX - radius);
                    obj.y = this.clamp(obj.y, minY + radius, maxY - radius);
                }
                return true;
            }

            case 'line':
            case 'arrow': {
                // Check both endpoints
                if (obj.x1 < minX || obj.x1 > maxX || obj.y1 < minY || obj.y1 > maxY ||
                    obj.x2 < minX || obj.x2 > maxX || obj.y2 < minY || obj.y2 > maxY) {
                    
                    // Clamp each point individually
                    obj.x1 = this.clamp(obj.x1, minX, maxX);
                    obj.y1 = this.clamp(obj.y1, minY, maxY);
                    obj.x2 = this.clamp(obj.x2, minX, maxX);
                    obj.y2 = this.clamp(obj.y2, minY, maxY);
                }
                return true;
            }

            case 'drawing':
            case 'triangle':
            case 'polygon': {
                // Check all points
                let anyOutside = false;
                const points = obj.points || [];
                
                points.forEach(p => {
                    if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) {
                        anyOutside = true;
                    }
                });
                
                if (anyOutside) {
                    // Clamp each point
                    points.forEach(p => {
                        p.x = this.clamp(p.x, minX, maxX);
                        p.y = this.clamp(p.y, minY, maxY);
                    });
                }
                return true;
            }

            default:
                return true;
        }
    }

    // FIXED: Takes objectId to get original geometry, now with bounds
    rotateObject(obj, objectId, totalAngle, origin, bounds) {
        // CRITICAL: Get ORIGINAL geometry from snapshot
        const original = this.initialStates.get(objectId);
        if (!original) return;

        const cos = Math.cos(totalAngle);
        const sin = Math.sin(totalAngle);

        const rotatePoint = (px, py) => {
            const dx = px - origin.x;
            const dy = py - origin.y;
            return {
                x: origin.x + dx * cos - dy * sin,
                y: origin.y + dx * sin + dy * cos
            };
        };

        switch (obj.type) {
            case 'rectangle':
            case 'text':
            case 'roundedRectangle':
            case 'image': {
                // Calculate from ORIGINAL center
                const originalCenterX = original.x + original.width / 2;
                const originalCenterY = original.y + original.height / 2;

                const center = rotatePoint(originalCenterX, originalCenterY);
                obj.x = center.x - original.width / 2;
                obj.y = center.y - original.height / 2;

                // Rotation = original rotation + total angle
                obj.rotation = (original.rotation || 0) + totalAngle;
                
                // 🔴 NEW: Ensure rotated object stays within bounds
                this.ensureWithinBounds(obj, original, totalAngle, origin, bounds);
                break;
            }

            case 'ellipse': {
                // Rotate ellipse center from original position
                const ellipseCenter = rotatePoint(original.x, original.y);
                obj.x = ellipseCenter.x;
                obj.y = ellipseCenter.y;
                obj.rotation = (original.rotation || 0) + totalAngle;
                
                // 🔴 NEW: Check bounds
                if (bounds) {
                    const radiusX = obj.radiusX || original.radiusX;
                    const radiusY = obj.radiusY || original.radiusY;
                    obj.x = this.clamp(obj.x, bounds.minX + radiusX, bounds.maxX - radiusX);
                    obj.y = this.clamp(obj.y, bounds.minY + radiusY, bounds.maxY - radiusY);
                }
                break;
            }

            case 'circle': {
                // From original position
                const circleCenter = rotatePoint(original.x, original.y);
                obj.x = circleCenter.x;
                obj.y = circleCenter.y;
                
                // 🔴 NEW: Check bounds
                if (bounds) {
                    const radius = obj.radius || original.radius;
                    obj.x = this.clamp(obj.x, bounds.minX + radius, bounds.maxX - radius);
                    obj.y = this.clamp(obj.y, bounds.minY + radius, bounds.maxY - radius);
                }
                break;
            }

            case 'line':
            case 'arrow': {
                // From original endpoints
                const start = rotatePoint(original.x1, original.y1);
                const end = rotatePoint(original.x2, original.y2);
                obj.x1 = start.x;
                obj.y1 = start.y;
                obj.x2 = end.x;
                obj.y2 = end.y;
                
                // 🔴 NEW: Clamp endpoints if needed
                if (bounds) {
                    obj.x1 = this.clamp(obj.x1, bounds.minX, bounds.maxX);
                    obj.y1 = this.clamp(obj.y1, bounds.minY, bounds.maxY);
                    obj.x2 = this.clamp(obj.x2, bounds.minX, bounds.maxX);
                    obj.y2 = this.clamp(obj.y2, bounds.minY, bounds.maxY);
                }
                break;
            }

            case 'drawing':
            case 'triangle':
            case 'polygon': {
                const originalPoints = original.points || [];
                const currentPoints = obj.points || [];

                originalPoints.forEach((originalPoint, index) => {
                    const currentPoint = currentPoints[index];
                    if (currentPoint) {
                        const rotated = rotatePoint(originalPoint.x, originalPoint.y);
                        currentPoint.x = rotated.x;
                        currentPoint.y = rotated.y;
                        
                        // 🔴 NEW: Clamp point if needed
                        if (bounds) {
                            currentPoint.x = this.clamp(currentPoint.x, bounds.minX, bounds.maxX);
                            currentPoint.y = this.clamp(currentPoint.y, bounds.minY, bounds.maxY);
                        }
                    }
                });

                obj._pointsVersion = (obj._pointsVersion || 0) + 1;
                delete obj._cachedBounds;
                break;
            }
        }
    }

    serialize() {
        const base = super.serialize();
        return {
            ...base,
            objectIds: this.objectIds,
            angle: this.angle,
            origin: this.origin,
            initialStates: this.initialStates ?
                Array.from(this.initialStates.entries()) : []
        };
    }

    static deserialize(data) {
        const command = new RotateCommand(data.objectIds, data.angle, data.origin);
        command.id = data.id;
        command.timestamp = data.timestamp;
        command.userId = data.userId;

        // Restore snapshots
        if (data.initialStates && data.initialStates.length > 0) {
            command.initialStates = new Map(data.initialStates);
        }

        return command;
    }
}