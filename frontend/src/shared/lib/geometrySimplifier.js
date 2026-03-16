// src/shared/lib/geometrySimplifier.js

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;

    // Line is actually a point
    if (dx === 0 && dy === 0) {
        return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
    }

    // Calculate distance using cross product
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);

    if (t < 0) {
        // Point is before line start
        return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
    }
    if (t > 1) {
        // Point is after line end
        return Math.hypot(point.x - lineEnd.x, point.y - lineEnd.y);
    }

    // Point is perpendicular to line
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    return Math.hypot(point.x - projX, point.y - projY);
}

/**
 * Ramer-Douglas-Peucker algorithm for point reduction
 */
export function simplifyPoints(points, tolerance = 2) {
    // If not enough points, return as is
    if (points.length <= 2) {
        return points;
    }

    const first = points[0];
    const last = points[points.length - 1];

    let maxDistance = 0;
    let index = 0;

    // Find point with maximum distance
    for (let i = 1; i < points.length - 1; i++) {
        const distance = perpendicularDistance(points[i], first, last);
        if (distance > maxDistance) {
            maxDistance = distance;
            index = i;
        }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDistance > tolerance) {
        const left = points.slice(0, index + 1);
        const right = points.slice(index);

        const leftResult = simplifyPoints(left, tolerance);
        const rightResult = simplifyPoints(right, tolerance);

        // Combine results (remove duplicate point at index)
        return [...leftResult.slice(0, -1), ...rightResult];
    } else {
        // All points are within tolerance, just keep first and last
        return [first, last];
    }
}

/**
 * Round coordinates to integers (optional, saves more space)
 */
export function roundPoints(points) {
    return points.map(p => ({
        x: Math.round(p.x),
        y: Math.round(p.y)
    }));
}