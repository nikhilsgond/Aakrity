import { BaseCommand } from '../history/BaseCommand.js';

export class MoveCommand extends BaseCommand {
    constructor(objectIds, delta) {
        super();
        this.objectIds = [...objectIds];
        this.delta = { ...delta };
        this.initialPositions = null;
        this.operation = 'move';
    }

    execute(state) {
        if (!this.initialPositions) {
            this.initialPositions = new Map();
            this.objectIds.forEach(id => {
                const obj = state.objects.find(o => o.id === id);
                if (obj) {
                    this.initialPositions.set(id, this.getPosition(obj));
                }
            });
        }

        // 🔴 NEW: Get bounds from state
        const bounds = state.canvasBounds;
        let moved = false;

        this.objectIds.forEach(id => {
            const obj = state.objects.find(o => o.id === id);
            if (!obj) return;

            const initial = this.initialPositions.get(id);
            if (!initial) return;

            // 🔴 NEW: Pass bounds to clamping function
            this.setAbsolutePosition(obj, initial, this.delta, bounds);
            moved = true;
        });

        return moved;
    }

    undo(state) {
        if (!this.initialPositions) return false;

        let reverted = false;

        this.objectIds.forEach(id => {
            const obj = state.objects.find(o => o.id === id);
            if (!obj) return;

            const original = this.initialPositions.get(id);
            if (original) {
                this.setPosition(obj, original);
                reverted = true;
            }
        });

        return reverted;
    }

    getPosition(obj) {
        // For shape objects, route by shapeType
        const t = (obj.type === 'shape' && obj.shapeType) ? obj.shapeType : obj.type;
        switch (t) {
            case 'rectangle':
            case 'circle':
            case 'text':
            case 'ellipse':
            case 'image':
            case 'emoji':
            case 'sticky':
                return {
                    x: obj.x ?? obj.cx ?? 0,
                    y: obj.y ?? obj.cy ?? 0,
                    width: obj.width,
                    height: obj.height,
                    radius: obj.radius,
                    radiusX: obj.radiusX,
                    radiusY: obj.radiusY,
                    type: t
                };
            case 'line':
            case 'arrow':
                return {
                    x1: obj.x1,
                    y1: obj.y1,
                    x2: obj.x2,
                    y2: obj.y2,
                    type: t
                };
            case 'triangle':
            case 'diamond':
            case 'star':
            case 'hexagon':
            case 'pentagon':
            case 'polygon':
            case 'drawing':
                return {
                    points: (obj.points || []).map(p => ({ ...p })),
                    type: t
                };
            default:
                console.warn('MoveCommand: Unknown object type:', obj.type);
                return { type: obj.type };
        }
    }

    setPosition(obj, position) {
        const t = (obj.type === 'shape' && obj.shapeType) ? obj.shapeType : obj.type;
        switch (t) {
            case 'rectangle':
            case 'circle':
            case 'text':
            case 'ellipse':
            case 'image':
            case 'emoji':
            case 'sticky':
                if (obj.x !== undefined) obj.x = position.x;
                if (obj.cx !== undefined) obj.cx = position.x;
                if (obj.y !== undefined) obj.y = position.y;
                if (obj.cy !== undefined) obj.cy = position.y;
                break;
            case 'line':
            case 'arrow':
                obj.x1 = position.x1;
                obj.y1 = position.y1;
                obj.x2 = position.x2;
                obj.y2 = position.y2;
                break;
            case 'triangle':
            case 'diamond':
            case 'star':
            case 'hexagon':
            case 'pentagon':
            case 'polygon':
            case 'drawing':
                if (position.points) {
                    obj.points = position.points.map(p => ({ ...p }));
                }
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
     * 🔴 NEW: Set absolute position with boundary clamping based on object type
     */
    setAbsolutePosition(obj, initialPosition, delta, bounds) {
        if (!bounds) {
            // No bounds provided, just move without clamping
            this._moveWithoutClamping(obj, initialPosition, delta);
            return;
        }

        const { minX, maxX, minY, maxY } = bounds;

        const t = (obj.type === 'shape' && obj.shapeType) ? obj.shapeType : obj.type;
        switch (t) {
            // ===== OBJECTS WITH SINGLE POSITION AND SIZE =====
            case 'rectangle':
            case 'roundedRectangle':
            case 'image':
            case 'emoji':
            case 'sticky':
                {
                    const width = obj.width || initialPosition.width || 0;
                    const height = obj.height || initialPosition.height || 0;

                    // Calculate new position
                    let newX = initialPosition.x + delta.x;
                    let newY = initialPosition.y + delta.y;

                    // Clamp to keep ENTIRE object inside bounds
                    newX = this.clamp(newX, minX, maxX - width);
                    newY = this.clamp(newY, minY, maxY - height);

                    // Apply
                    if (obj.x !== undefined) obj.x = newX;
                    if (obj.cx !== undefined) obj.cx = newX;
                    if (obj.y !== undefined) obj.y = newY;
                    if (obj.cy !== undefined) obj.cy = newY;
                }
                break;

            case 'circle':
                {
                    const radius = obj.radius || initialPosition.radius || 0;

                    let newX = initialPosition.x + delta.x;
                    let newY = initialPosition.y + delta.y;

                    // Clamp to keep entire circle inside (center ± radius)
                    newX = this.clamp(newX, minX + radius, maxX - radius);
                    newY = this.clamp(newY, minY + radius, maxY - radius);

                    if (obj.x !== undefined) obj.x = newX;
                    if (obj.cx !== undefined) obj.cx = newX;
                    if (obj.y !== undefined) obj.y = newY;
                    if (obj.cy !== undefined) obj.cy = newY;
                }
                break;

            case 'ellipse':
                {
                    const radiusX = obj.radiusX || (obj.width / 2) || 0;
                    const radiusY = obj.radiusY || (obj.height / 2) || 0;

                    let newX = initialPosition.x + delta.x;
                    let newY = initialPosition.y + delta.y;

                    newX = this.clamp(newX, minX + radiusX, maxX - radiusX);
                    newY = this.clamp(newY, minY + radiusY, maxY - radiusY);

                    if (obj.x !== undefined) obj.x = newX;
                    if (obj.cx !== undefined) obj.cx = newX;
                    if (obj.y !== undefined) obj.y = newY;
                    if (obj.cy !== undefined) obj.cy = newY;
                }
                break;

            case 'text':
                {
                    const width = obj.width || 50;
                    const height = obj.height || 20;

                    let newX = initialPosition.x + delta.x;
                    let newY = initialPosition.y + delta.y;

                    newX = this.clamp(newX, minX, maxX - width);
                    newY = this.clamp(newY, minY, maxY - height);

                    if (obj.x !== undefined) obj.x = newX;
                    if (obj.y !== undefined) obj.y = newY;
                }
                break;

            // ===== OBJECTS WITH TWO POINTS =====
            case 'line':
            case 'arrow':
                {
                    // Calculate both points moved by delta
                    let newX1 = initialPosition.x1 + delta.x;
                    let newY1 = initialPosition.y1 + delta.y;
                    let newX2 = initialPosition.x2 + delta.x;
                    let newY2 = initialPosition.y2 + delta.y;

                    // Clamp each point individually
                    newX1 = this.clamp(newX1, minX, maxX);
                    newY1 = this.clamp(newY1, minY, maxY);
                    newX2 = this.clamp(newX2, minX, maxX);
                    newY2 = this.clamp(newY2, minY, maxY);

                    obj.x1 = newX1;
                    obj.y1 = newY1;
                    obj.x2 = newX2;
                    obj.y2 = newY2;
                }
                break;

            // ===== OBJECTS WITH MULTIPLE POINTS =====
            case 'triangle':
            case 'diamond':
            case 'star':
            case 'hexagon':
            case 'pentagon':
            case 'polygon':
            case 'drawing':
                {
                    const initialPoints = initialPosition.points || [];
                    const currentPoints = obj.points || [];

                    // Move each point by delta, then clamp
                    initialPoints.forEach((initialPoint, index) => {
                        const currentPoint = currentPoints[index];
                        if (currentPoint) {
                            let newX = initialPoint.x + delta.x;
                            let newY = initialPoint.y + delta.y;

                            // Clamp each point individually
                            newX = this.clamp(newX, minX, maxX);
                            newY = this.clamp(newY, minY, maxY);

                            currentPoint.x = newX;
                            currentPoint.y = newY;
                        }
                    });

                    if (obj._pointsVersion !== undefined) {
                        obj._pointsVersion = (obj._pointsVersion || 0) + 1;
                    }
                    delete obj._cachedBounds;
                }
                break;

            default:
                // Fallback for unknown types
                this._moveWithoutClamping(obj, initialPosition, delta);
                break;
        }
    }

    /**
     * 🔴 NEW: Fallback move without clamping (for unknown types or no bounds)
     */
    _moveWithoutClamping(obj, initialPosition, delta) {
        const t = (obj.type === 'shape' && obj.shapeType) ? obj.shapeType : obj.type;
        switch (t) {
            case 'rectangle':
            case 'circle':
            case 'text':
            case 'roundedRectangle':
            case 'ellipse':
            case 'image':
            case 'emoji':
            case 'sticky':
                if (obj.x !== undefined) obj.x = initialPosition.x + delta.x;
                if (obj.cx !== undefined) obj.cx = initialPosition.x + delta.x;
                if (obj.y !== undefined) obj.y = initialPosition.y + delta.y;
                if (obj.cy !== undefined) obj.cy = initialPosition.y + delta.y;
                break;
            case 'line':
            case 'arrow':
                obj.x1 = initialPosition.x1 + delta.x;
                obj.y1 = initialPosition.y1 + delta.y;
                obj.x2 = initialPosition.x2 + delta.x;
                obj.y2 = initialPosition.y2 + delta.y;
                break;
            case 'triangle':
            case 'diamond':
            case 'star':
            case 'hexagon':
            case 'pentagon':
            case 'polygon':
            case 'drawing': {
                const initialPoints = initialPosition.points || [];
                const currentPoints = obj.points || [];

                initialPoints.forEach((initialPoint, index) => {
                    const currentPoint = currentPoints[index];
                    if (currentPoint) {
                        currentPoint.x = initialPoint.x + delta.x;
                        currentPoint.y = initialPoint.y + delta.y;
                    }
                });

                if (obj._pointsVersion !== undefined) {
                    obj._pointsVersion = (obj._pointsVersion || 0) + 1;
                }
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
            delta: this.delta,
            initialPositions: this.initialPositions ?
                Array.from(this.initialPositions.entries()) : []
        };
    }

    static deserialize(data) {
        const command = new MoveCommand(data.objectIds, data.delta);
        command.id = data.id;
        command.timestamp = data.timestamp;
        command.userId = data.userId;

        if (data.initialPositions && data.initialPositions.length > 0) {
            command.initialPositions = new Map(data.initialPositions);
        }

        return command;
    }
}