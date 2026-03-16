import { BaseCommand } from '../history/BaseCommand.js';

export class ResizeCommand extends BaseCommand {
    constructor(objectIds, resizeData) {
        super();
        this.objectIds = Array.isArray(objectIds) ? [...objectIds] : [];
        this.resizeData = { ...resizeData };
        this.isOBB = resizeData.isOBB || false;
        this.initialStates = null;
        this.origin = resizeData.origin || { x: 0, y: 0 };
        this.scaleX = resizeData.scaleX || 1;
        this.scaleY = resizeData.scaleY || 1;
        this.operation = 'resize';
    }

    execute(state) {
        if (!state || !Array.isArray(state.objects)) return false;
        if (this.objectIds.length === 0) return false;
        if (!isFinite(this.scaleX) || !isFinite(this.scaleY)) return false;

        // 🔴 NEW: Get bounds from state
        const bounds = state.canvasBounds;

        if (!this.initialStates) this.initialStates = new Map();

        let resized = false;
        const validObjects = [];

        this.objectIds.forEach(id => {
            const obj = state.objects.find(o => o.id === id);
            if (!obj) return;

            if (!this.initialStates.has(id)) {
                this.initialStates.set(id, this.getGeometry(obj));
            }

            validObjects.push({ obj, id });
        });

        if (validObjects.length === 0) return false;

        validObjects.forEach(({ obj, id }) => {
            // 🔴 NEW: Pass bounds to resize function
            this.resizeObject(obj, id, bounds);
            resized = true;
        });

        return resized;
    }

    undo(state) {
        if (!state || !Array.isArray(state.objects)) return false;
        if (!this.initialStates || this.initialStates.size === 0) return false;

        let reverted = false;

        state.objects.forEach(obj => {
            if (this.objectIds.includes(obj.id) && this.initialStates.has(obj.id)) {
                const original = this.initialStates.get(obj.id);
                if (original) {
                    this.setGeometry(obj, original);
                    reverted = true;
                }
            }
        });

        return reverted;
    }

    getGeometry(obj) {
        if (!obj || typeof obj !== 'object') return { type: 'unknown' };

        const geometry = { type: obj.type || 'unknown', id: obj.id };

        // CRITICAL FIX: Include radiusX and radiusY for ellipse
        const props = ['x', 'y', 'width', 'height', 'radius', 'radiusX', 'radiusY', 'cornerRadius',
            'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'rx', 'ry', 'points', 'rotation'];
        props.push('flipX', 'flipY', 'scaleX', 'scaleY');

        // Save fontSize for text objects so we can scale it during resize
        if (obj.type === 'text' && obj.fontSize !== undefined) {
            props.push('fontSize');
        }

        props.forEach(prop => {
            if (obj[prop] !== undefined && obj[prop] !== null) {
                if (Array.isArray(obj[prop])) {
                    geometry[prop] = JSON.parse(JSON.stringify(obj[prop]));
                } else {
                    geometry[prop] = obj[prop];
                }
            }
        });

        return geometry;
    }

    setGeometry(obj, geometry) {
        if (!obj || !geometry || geometry.type !== obj.type) return;

        Object.keys(geometry).forEach(key => {
            if (key !== 'type' && key !== 'id' && geometry[key] !== undefined) {
                obj[key] = geometry[key];
            }
        });

        delete obj._cachedBounds;
        delete obj._boundsVersion;
        if (obj._pointsVersion !== undefined) obj._pointsVersion++;
    }

    /**
     * 🔴 NEW: Helper to clamp a value between min and max
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * 🔴 NEW: Check if resized object stays within bounds and adjust if needed
     */
    enforceBounds(obj, original, bounds) {
        if (!bounds) return;

        const { minX, maxX, minY, maxY } = bounds;
        const effectiveType = (obj.type === 'shape' && obj.shapeType) ? obj.shapeType : obj.type;

        switch (effectiveType) {
            case 'rectangle':
            case 'roundedRectangle':
            case 'image':
            case 'emoji':
            case 'sticky':
            case 'frame':
            case 'text': {
                // Check if object exceeds bounds
                if (obj.x < minX || obj.x + obj.width > maxX ||
                    obj.y < minY || obj.y + obj.height > maxY) {

                    // Try to shift object back into bounds
                    const shiftX = Math.max(0, minX - obj.x) - Math.max(0, (obj.x + obj.width) - maxX);
                    const shiftY = Math.max(0, minY - obj.y) - Math.max(0, (obj.y + obj.height) - maxY);

                    obj.x += shiftX;
                    obj.y += shiftY;

                    // If still outside, we may need to reduce size
                    if (obj.x < minX) {
                        const newWidth = obj.width - (minX - obj.x);
                        if (newWidth >= 4) {
                            obj.width = newWidth;
                            obj.x = minX;
                        }
                    }
                    if (obj.x + obj.width > maxX) {
                        const newWidth = maxX - obj.x;
                        if (newWidth >= 4) {
                            obj.width = newWidth;
                        }
                    }
                    if (obj.y < minY) {
                        const newHeight = obj.height - (minY - obj.y);
                        if (newHeight >= 4) {
                            obj.height = newHeight;
                            obj.y = minY;
                        }
                    }
                    if (obj.y + obj.height > maxY) {
                        const newHeight = maxY - obj.y;
                        if (newHeight >= 4) {
                            obj.height = newHeight;
                        }
                    }
                }
                break;
            }

            case 'circle': {
                const radius = obj.radius;
                if (obj.x - radius < minX || obj.x + radius > maxX ||
                    obj.y - radius < minY || obj.y + radius > maxY) {

                    obj.x = this.clamp(obj.x, minX + radius, maxX - radius);
                    obj.y = this.clamp(obj.y, minY + radius, maxY - radius);
                }
                break;
            }

            case 'ellipse': {
                const radiusX = obj.radiusX;
                const radiusY = obj.radiusY;
                if (obj.x - radiusX < minX || obj.x + radiusX > maxX ||
                    obj.y - radiusY < minY || obj.y + radiusY > maxY) {

                    obj.x = this.clamp(obj.x, minX + radiusX, maxX - radiusX);
                    obj.y = this.clamp(obj.y, minY + radiusY, maxY - radiusY);
                }
                break;
            }

            case 'line':
            case 'arrow': {
                obj.x1 = this.clamp(obj.x1, minX, maxX);
                obj.y1 = this.clamp(obj.y1, minY, maxY);
                obj.x2 = this.clamp(obj.x2, minX, maxX);
                obj.y2 = this.clamp(obj.y2, minY, maxY);
                break;
            }

            case 'triangle':
            case 'diamond':
            case 'star':
            case 'hexagon':
            case 'pentagon':
            case 'polygon':
            case 'drawing': {
                const points = obj.points || [];
                points.forEach(p => {
                    p.x = this.clamp(p.x, minX, maxX);
                    p.y = this.clamp(p.y, minY, maxY);
                });
                break;
            }
        }
    }

    resizeObject(obj, objectId, bounds) {
        const original = this.initialStates.get(objectId);
        // For shape objects, type is 'shape' on both obj and original — allow match
        if (!original) return;
        if (original.type !== obj.type && !(obj.type === 'shape' && original.shapeType === obj.shapeType)) return;

        const applyScaling = (x, y) => ({
            x: this.origin.x + (x - this.origin.x) * this.scaleX,
            y: this.origin.y + (y - this.origin.y) * this.scaleY
        });

        const absScaleX = Math.abs(this.scaleX);
        const absScaleY = Math.abs(this.scaleY);
        const MIN_SIZE = 4;
        const MIN_RADIUS = 0.1;

        const setFlipFromScale = () => {
            const baseFlipX = !!original.flipX;
            const baseFlipY = !!original.flipY;
            obj.flipX = this.scaleX < 0 ? !baseFlipX : baseFlipX;
            obj.flipY = this.scaleY < 0 ? !baseFlipY : baseFlipY;
        };

        // Route shape objects by shapeType
        const effectiveType = (obj.type === 'shape' && obj.shapeType) ? obj.shapeType : obj.type;

        switch (effectiveType) {
            case 'text': {
                const isTextFontResize = this.resizeData && this.resizeData.isTextFontResize;

                const left = original.x;
                const right = original.x + original.width;
                const top = original.y;
                const bottom = original.y + original.height;

                const scaledLeft = this.origin.x + (left - this.origin.x) * this.scaleX;
                const scaledRight = this.origin.x + (right - this.origin.x) * this.scaleX;
                const scaledTop = this.origin.y + (top - this.origin.y) * this.scaleY;

                const rawX = Math.min(scaledLeft, scaledRight);
                const rawY = scaledTop;
                const rawW = Math.abs(scaledRight - scaledLeft);

                let width = Math.max(MIN_SIZE, rawW);

                obj.x = this.scaleX >= 0 ? rawX : rawX - (width - rawW);
                obj.y = rawY;
                obj.width = width;
                setFlipFromScale();
                obj.scaleX = 1;
                obj.scaleY = 1;

                // Scale fontSize proportionally for corner/top/bottom handle resizes
                if (isTextFontResize && original.fontSize) {
                    const uniformScale = Math.max(absScaleX, absScaleY);
                    const MIN_FONT_SIZE = 8;
                    const MAX_FONT_SIZE = 500;
                    obj.fontSize = Math.round(
                        Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, original.fontSize * uniformScale))
                    );
                }

                // Recalculate visual line count from wrapped content for robust auto-height.
                if (obj.autoHeight !== false) {
                    const fontSize = obj.fontSize || original.fontSize || 16;
                    const lineHeight = fontSize * 1.2;
                    const fontFamily = obj.fontFamily || original.fontFamily || 'Arial, sans-serif';
                    const fontWeight = obj.fontWeight || original.fontWeight || 'normal';
                    const fontStyle = obj.fontStyle || original.fontStyle || 'normal';
                    const listType = obj.listType || original.listType || 'none';
                    const textContent = obj.text || '';

                    const tempCanvas = document.createElement('canvas');
                    const tempCtx = tempCanvas.getContext('2d');
                    let totalVisualLines = 0;
                    const rawLines = textContent.split('\n');

                    if (tempCtx) {
                        tempCtx.font = `${fontWeight} ${fontStyle} ${fontSize}px ${fontFamily}`;

                        const markerSpace = listType !== 'none' ? fontSize * 1.2 : 0;
                        const padding = fontSize * 0.4;
                        const extraBuffer = fontSize * 0.5;
                        const availableWidth = Math.max(
                            fontSize,
                            (obj.width || 0) - padding * 2 - extraBuffer - markerSpace
                        );

                        for (const rawLine of rawLines) {
                            if (!rawLine.length) {
                                totalVisualLines += 1;
                                continue;
                            }

                            const words = rawLine.split(/(\s+)/);
                            let currentLineWidth = 0;
                            let visualLinesForThisLine = 1;

                            for (const word of words) {
                                const wordWidth = tempCtx.measureText(word).width;
                                if (currentLineWidth + wordWidth > availableWidth && currentLineWidth > 0) {
                                    visualLinesForThisLine += 1;
                                    currentLineWidth = wordWidth;
                                } else if (wordWidth > availableWidth) {
                                    let chunkWidth = currentLineWidth;
                                    for (const ch of word) {
                                        const chWidth = tempCtx.measureText(ch).width;
                                        if (chunkWidth + chWidth > availableWidth && chunkWidth > 0) {
                                            visualLinesForThisLine += 1;
                                            chunkWidth = chWidth;
                                        } else {
                                            chunkWidth += chWidth;
                                        }
                                    }
                                    currentLineWidth = chunkWidth;
                                } else {
                                    currentLineWidth += wordWidth;
                                }
                            }

                            totalVisualLines += visualLinesForThisLine;
                        }
                    } else {
                        totalVisualLines = Math.max(1, rawLines.length);
                    }

                    obj.height = Math.max(totalVisualLines * lineHeight, lineHeight);
                }

                // 🔴 NEW: Enforce bounds
                this.enforceBounds(obj, original, bounds);
                break;
            }

            case 'roundedRectangle':
            case 'rectangle':
            case 'image':
            case 'emoji':
            case 'sticky':
            case 'frame': {
                const left = original.x;
                const right = original.x + original.width;
                const top = original.y;
                const bottom = original.y + original.height;

                const scaledLeft = this.origin.x + (left - this.origin.x) * this.scaleX;
                const scaledRight = this.origin.x + (right - this.origin.x) * this.scaleX;
                const scaledTop = this.origin.y + (top - this.origin.y) * this.scaleY;
                const scaledBottom = this.origin.y + (bottom - this.origin.y) * this.scaleY;

                const rawX = Math.min(scaledLeft, scaledRight);
                const rawY = Math.min(scaledTop, scaledBottom);
                const rawW = Math.abs(scaledRight - scaledLeft);
                const rawH = Math.abs(scaledBottom - scaledTop);

                let width = Math.max(MIN_SIZE, rawW);
                let height = Math.max(MIN_SIZE, rawH);

                // Keep anchor side stable when min-size clamp kicks in.
                obj.x = this.scaleX >= 0 ? rawX : rawX - (width - rawW);
                obj.y = this.scaleY >= 0 ? rawY : rawY - (height - rawH);
                obj.width = width;
                obj.height = height;
                setFlipFromScale();
                obj.scaleX = 1;
                obj.scaleY = 1;

                if (original.cornerRadius !== undefined) {
                    const maxRadius = Math.min(width, height) / 2;
                    const scale = Math.min(absScaleX, absScaleY);
                    obj.cornerRadius = Math.min(original.cornerRadius * scale, maxRadius);
                }

                // 🔴 NEW: Enforce bounds
                this.enforceBounds(obj, original, bounds);
                break;
            }

            case 'circle': {
                // Keep circle center fixed while resizing to prevent axis drift.
                const newCenter = { x: original.x, y: original.y };
                const handle = this.resizeData?.handle;
                const horizontalHandles = new Set(['l', 'w', 'r', 'e']);
                const verticalHandles = new Set(['t', 'n', 'b', 's']);
                let radiusScale;

                if (horizontalHandles.has(handle)) {
                    radiusScale = absScaleX;
                } else if (verticalHandles.has(handle)) {
                    radiusScale = absScaleY;
                } else {
                    radiusScale = Math.max(absScaleX, absScaleY);
                }

                let newRadius = Math.max(MIN_RADIUS, original.radius * radiusScale);

                obj.x = newCenter.x;
                obj.y = newCenter.y;
                obj.radius = newRadius;
                setFlipFromScale();

                // 🔴 NEW: Enforce bounds
                this.enforceBounds(obj, original, bounds);
                break;
            }

            case 'ellipse': {
                const newEllipseCenter = applyScaling(original.x, original.y);
                const originalRadiusX = original.radiusX || 0;
                const originalRadiusY = original.radiusY || 0;

                let newRadiusX = originalRadiusX * absScaleX;
                let newRadiusY = originalRadiusY * absScaleY;

                obj.x = newEllipseCenter.x;
                obj.y = newEllipseCenter.y;
                obj.radiusX = Math.max(MIN_RADIUS, newRadiusX);
                obj.radiusY = Math.max(MIN_RADIUS, newRadiusY);
                setFlipFromScale();

                // 🔴 NEW: Enforce bounds
                this.enforceBounds(obj, original, bounds);
                break;
            }

            case 'line':
            case 'arrow': {
                const start = applyScaling(original.x1, original.y1);
                const end = applyScaling(original.x2, original.y2);

                obj.x1 = start.x;
                obj.y1 = start.y;
                obj.x2 = end.x;
                obj.y2 = end.y;

                // 🔴 NEW: Enforce bounds
                this.enforceBounds(obj, original, bounds);
                break;
            }

            case 'triangle':
            case 'diamond':
            case 'star':
            case 'hexagon':
            case 'pentagon':
            case 'polygon':
            case 'drawing': {
                const originalPoints = original.points || [];
                obj.points = originalPoints.map(p => {
                    const scaled = applyScaling(p.x, p.y);
                    return {
                        x: scaled.x,
                        y: scaled.y,
                        pressure: p.pressure,
                        timestamp: p.timestamp
                    };
                });

                setFlipFromScale();
                if (obj._pointsVersion !== undefined) obj._pointsVersion++;

                // 🔴 NEW: Enforce bounds
                this.enforceBounds(obj, original, bounds);
                break;
            }

            default:
                console.warn('ResizeCommand: Unhandled effectiveType', effectiveType, obj.type, obj.shapeType);
                return;
        }

        delete obj._cachedBounds;
        delete obj._boundsVersion;
        if (obj._pointsVersion !== undefined) obj._pointsVersion++;
        if (original.rotation !== undefined) obj.rotation = original.rotation;
    }

    serialize() {
        const base = super.serialize();

        const serializedStates = this.initialStates ?
            Array.from(this.initialStates.entries()).map(([key, value]) => {
                try {
                    return [key, JSON.parse(JSON.stringify(value))];
                } catch (e) {
                    return [key, value];
                }
            }) : [];

        return {
            ...base,
            objectIds: this.objectIds,
            resizeData: this.resizeData,
            isOBB: this.isOBB,
            origin: this.origin,
            scaleX: this.scaleX,
            scaleY: this.scaleY,
            initialStates: serializedStates
        };
    }

    static deserialize(data) {
        const command = new ResizeCommand(data.objectIds, data.resizeData);
        command.id = data.id;
        command.timestamp = data.timestamp;
        command.userId = data.userId;

        if (data.isOBB !== undefined) command.isOBB = data.isOBB;
        if (data.origin) command.origin = data.origin;
        if (data.scaleX !== undefined) command.scaleX = data.scaleX;
        if (data.scaleY !== undefined) command.scaleY = data.scaleY;

        if (data.initialStates && Array.isArray(data.initialStates)) {
            command.initialStates = new Map(data.initialStates);
        }

        return command;
    }
}