// src/features/canvas/hooks/useCollaboration.js
import { useEffect, useRef, useCallback, useMemo } from 'react';
import useCollaborationStore from '@features/room/state/collaborationStore';
import { toast } from 'react-toastify';

// Throttle configuration for different operation types
const THROTTLE_CONFIG = Object.freeze({
  // High-frequency events (~60fps)
  'drawing:start': 16,
  'drawing:point': 16,
  'drawing:end': 16,
  'move:update': 16,
  'transform:update': 16,
  'shape:preview': 16,
  'cursor:move': 16,

  // Medium frequency
  'text:update': 50,

  // Low frequency
  'selection:update': 100,
  'undo': 100,
  'redo': 100,
});

// Batch drawing points to reduce WebSocket traffic
const DRAWING_BATCH_SIZE = 40; // Send every 40 points
const DRAWING_BATCH_TIMEOUT = 80; // Or after 80ms, whichever comes first
const MAX_QUEUE_SPACING = 500; // Maximum delay between queued operations (ms)
const MAX_REPLAY_BATCH = 300; // Maximum operations to replay at once

// Ramer-Douglas-Peucker simplification threshold (removes ~80% of points while preserving shape)
const RDP_EPSILON = 2.0; // Higher = more compression, lower = more accuracy

// Configuration options
const DEFAULT_CONFIG = {
  enableCursorTracking: true,
  enableSelectionTracking: true,
  enableOperationThrottling: true,
  enableDrawingBatching: true,
  enableDeltaCompression: true,
  enableDuplicatePointFiltering: true,
  enableAdaptiveSampling: true,
  enableRamerDouglasPeucker: true,
  cursorThrottleMs: 16,
  minCursorMoveDelta: 2,
  showOfflineWarning: true,
  maxOfflineQueueSize: 1000,
  rdpEpsilon: RDP_EPSILON,
};

// Generate unique client ID for this session
const generateClientId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

// Ramer-Douglas-Peucker algorithm for stroke simplification
const simplifyPoints = (points, epsilon) => {
  if (points.length < 3) return points;

  // Find the point with maximum distance
  let maxDistance = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    const left = simplifyPoints(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPoints(points.slice(maxIndex), epsilon);
    return left.slice(0, -1).concat(right);
  } else {
    return [first, last];
  }
};

// Calculate perpendicular distance from point to line
const perpendicularDistance = (point, lineStart, lineEnd) => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // Line is a point
  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) +
      Math.pow(point.y - lineStart.y, 2)
    );
  }

  // Calculate perpendicular distance
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);

  if (t < 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) +
      Math.pow(point.y - lineStart.y, 2)
    );
  }

  if (t > 1) {
    return Math.sqrt(
      Math.pow(point.x - lineEnd.x, 2) +
      Math.pow(point.y - lineEnd.y, 2)
    );
  }

  const projection = {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy
  };

  return Math.sqrt(
    Math.pow(point.x - projection.x, 2) +
    Math.pow(point.y - projection.y, 2)
  );
};

// Adaptive sampling based on drawing speed
const shouldSamplePoint = (point, lastPoint, speed, config) => {
  if (!config.enableAdaptiveSampling) return true;

  const dx = point.x - lastPoint.x;
  const dy = point.y - lastPoint.y;
  const distanceSq = dx * dx + dy * dy;

  // Higher sample rate when moving fast (preserve detail)
  // Lower sample rate when slow (reduce data)
  const sampleRate = Math.min(1, Math.max(0.2, speed / 100));

  return distanceSq > config.minCursorMoveDelta ** 2 && Math.random() < sampleRate;
};

export const useCollaboration = (
  canvasManager,
  roomId,
  userId,
  config = {}
) => {
  const options = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config]
  );

  const {
    sendCanvasOperation: storeSendOperation,
    isConnected,
    users,
  } = useCollaborationStore();

  const clientIdRef = useRef(generateClientId());
  const throttleTimersRef = useRef({});
  const pendingOpsRef = useRef({});
  const selectionHandlerRef = useRef(null);
  const offlineQueueRef = useRef([]);
  const offlineWarningShownRef = useRef(false);

  // Drawing batching refs
  const drawingBatchRef = useRef([]);
  const drawingBatchTimerRef = useRef(null);
  const lastDrawingPointRef = useRef(null);
  const drawingSpeedRef = useRef(0);

  // Track if component is mounted
  const isMountedRef = useRef(true);

  // Pre-calculate squared min delta for performance
  const minDeltaSquared = useMemo(
    () => options.minCursorMoveDelta ** 2,
    [options.minCursorMoveDelta]
  );

  // Wrap sendOperation to include roomId and clientId
  const sendCanvasOperation = useCallback((operation) => {
    storeSendOperation({
      roomId,
      clientId: clientIdRef.current,
      ...operation,
    });
  }, [roomId, storeSendOperation]);

  // Clear drawing batch timer on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (drawingBatchTimerRef.current) {
        clearTimeout(drawingBatchTimerRef.current);
        drawingBatchTimerRef.current = null;
      }

      drawingBatchRef.current = [];
    };
  }, []);

  // Delta compress points with optional RDP simplification
  const compressPoints = useCallback((points) => {
    if (!points.length) return [];

    // Apply Ramer-Douglas-Peucker simplification first (if enabled)
    let simplified = points;
    if (options.enableRamerDouglasPeucker) {
      simplified = simplifyPoints(points, options.rdpEpsilon);
    }

    if (!options.enableDeltaCompression) return simplified;

    const compressed = [];
    const first = simplified[0];
    let lastX = first.x;
    let lastY = first.y;

    // First point is absolute (rounded for consistency)
    compressed.push([Math.round(lastX), Math.round(lastY)]);

    // Subsequent points are deltas with quantization
    for (let i = 1; i < simplified.length; i++) {
      const dx = Math.round(simplified[i].x - lastX);
      const dy = Math.round(simplified[i].y - lastY);

      // Only store if movement > 1 pixel
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        compressed.push([dx, dy]);
        lastX = simplified[i].x;
        lastY = simplified[i].y;
      }
    }

    return compressed;
  }, [options.enableDeltaCompression, options.enableRamerDouglasPeucker, options.rdpEpsilon]);

  // Decompress points (on receiving end)
  const decompressPoints = useCallback((compressed) => {
    if (!compressed.length) return [];
    if (!options.enableDeltaCompression || !Array.isArray(compressed[0])) {
      return compressed;
    }

    const points = [];
    let x = 0, y = 0;

    for (let i = 0; i < compressed.length; i++) {
      if (i === 0) {
        // First point is absolute
        x = compressed[i][0];
        y = compressed[i][1];
        points.push({ x, y });
      } else {
        // Subsequent points are deltas
        x += compressed[i][0];
        y += compressed[i][1];
        points.push({ x, y });
      }
    }

    return points;
  }, [options.enableDeltaCompression]);

  // Flush drawing batch
  const flushDrawingBatch = useCallback(() => {
    if (!isMountedRef.current) return;
    if (drawingBatchRef.current.length === 0) return;

    const batch = [...drawingBatchRef.current];
    drawingBatchRef.current = [];
    lastDrawingPointRef.current = null;
    drawingSpeedRef.current = 0;

    if (drawingBatchTimerRef.current) {
      clearTimeout(drawingBatchTimerRef.current);
      drawingBatchTimerRef.current = null;
    }

    // Safely extract points
    const rawPoints = [];
    for (let i = 0; i < batch.length; i++) {
      const p = batch[i].point ?? batch[i].position;
      if (p) {
        rawPoints.push({ x: p.x, y: p.y });
      }
    }

    // Compress points
    const compressed = compressPoints(rawPoints);

    if (isConnected && isMountedRef.current) {
      sendCanvasOperation({
        type: 'drawing:batch',
        points: compressed,
        userId,
        timestamp: Date.now(),
        version: canvasManager?.getVersion?.() ?? 1,
        compressed: options.enableDeltaCompression,
        simplified: options.enableRamerDouglasPeucker, // Flag for receiver
      });
    } else if (!isConnected && isMountedRef.current) {
      offlineQueueRef.current.push({
        type: 'drawing:batch',
        points: compressed,
        userId,
        timestamp: Date.now(),
        version: canvasManager?.getVersion?.() ?? 1,
        compressed: options.enableDeltaCompression,
        simplified: options.enableRamerDouglasPeucker,
      });

      if (offlineQueueRef.current.length > options.maxOfflineQueueSize) {
        offlineQueueRef.current.shift();
      }
    }
  }, [isConnected, sendCanvasOperation, userId, canvasManager, options.maxOfflineQueueSize, compressPoints, options.enableDeltaCompression, options.enableRamerDouglasPeucker]);

  // Process a single operation
  const processOperation = useCallback((operation) => {
    // Handle drawing end
    if (operation.type === 'drawing:end') {
      flushDrawingBatch();

      if (isConnected && isMountedRef.current) {
        sendCanvasOperation(operation);
      } else if (!isConnected && isMountedRef.current) {
        offlineQueueRef.current.push(operation);
      }

      return true;
    }

    // Handle drawing batching
    if (options.enableDrawingBatching && operation.type === 'drawing:point') {

      // Safely extract point
      const p = operation.point ?? operation.position;
      if (!p) return true;

      const currentPoint = { x: p.x, y: p.y };
      const now = Date.now();

      // Adaptive sampling
      if (options.enableAdaptiveSampling && lastDrawingPointRef.current) {
        const last = lastDrawingPointRef.current;
        const timeDiff = now - (last.timestamp || now);
        const dx = currentPoint.x - last.x;
        const dy = currentPoint.y - last.y;
        const distanceSq = dx * dx + dy * dy;

        // Use squared distance to avoid sqrt
        if (distanceSq < minDeltaSquared) return true;

        // Calculate drawing speed
        const speed = timeDiff > 0 ? Math.sqrt(distanceSq) / timeDiff : 0;
        drawingSpeedRef.current = speed * 0.3 + drawingSpeedRef.current * 0.7;

        // Sample based on speed
        if (!shouldSamplePoint(currentPoint, last, drawingSpeedRef.current, options)) {
          return true;
        }
      }

      // Duplicate filtering
      if (options.enableDuplicatePointFiltering && lastDrawingPointRef.current) {
        const last = lastDrawingPointRef.current;
        if (last.x === currentPoint.x && last.y === currentPoint.y) {
          return true;
        }
      }

      // Store point
      drawingBatchRef.current.push({
        ...operation,
        point: currentPoint,
        timestamp: now,
      });

      lastDrawingPointRef.current = {
        ...currentPoint,
        timestamp: now,
      };

      // Flush if batch is full
      if (drawingBatchRef.current.length >= DRAWING_BATCH_SIZE) {
        flushDrawingBatch();
      } else if (!drawingBatchTimerRef.current) {
        drawingBatchTimerRef.current = setTimeout(flushDrawingBatch, DRAWING_BATCH_TIMEOUT);
      }

      return true;
    }

    // Throttling for other operations
    if (options.enableOperationThrottling) {
      const throttleTime = THROTTLE_CONFIG[operation.type];

      if (throttleTime) {
        const bucket = pendingOpsRef.current[operation.type] ??
          (pendingOpsRef.current[operation.type] = []);

        if (operation.type !== 'cursor:move') {
          bucket.length = 0;
        }
        bucket.push(operation);

        if (!throttleTimersRef.current[operation.type]) {
          throttleTimersRef.current[operation.type] = setTimeout(() => {
            if (!isMountedRef.current) {
              delete pendingOpsRef.current[operation.type];
              delete throttleTimersRef.current[operation.type];
              return;
            }

            const ops = pendingOpsRef.current[operation.type] || [];

            if (ops.length > 0) {
              const firstOpType = ops[0]?.type;

              if (firstOpType === 'cursor:move') {
                sendCanvasOperation(ops[ops.length - 1]);
              } else {
                sendCanvasOperation(ops[ops.length - 1]);
              }
            }

            delete pendingOpsRef.current[operation.type];
            delete throttleTimersRef.current[operation.type];
          }, throttleTime);
        }

        return true;
      }
    }

    if (isMountedRef.current) {
      sendCanvasOperation(operation);
    }
    return true;
  }, [options.enableDrawingBatching, options.enableOperationThrottling, options.enableDuplicatePointFiltering, options.enableAdaptiveSampling, minDeltaSquared, flushDrawingBatch, sendCanvasOperation, isConnected]);

  // Main track operation function
  const trackOperation = useCallback(
    (operation) => {
      const version = canvasManager?.getVersion?.() ?? 1;

      const operationToSend = {
        ...operation,
        userId,
        timestamp: Date.now(),
        version,
      };

      if (!isConnected) {
        offlineQueueRef.current.push(operationToSend);

        if (offlineQueueRef.current.length > options.maxOfflineQueueSize) {
          offlineQueueRef.current.shift();
        }

        if (options.showOfflineWarning && !offlineWarningShownRef.current && isMountedRef.current) {
          toast.warning('You are offline. Changes will sync when connection resumes.', {
            toastId: 'offline-warning',
          });
          offlineWarningShownRef.current = true;
        }

        return true;
      }

      if (offlineWarningShownRef.current && isMountedRef.current) {
        toast.dismiss('offline-warning');
        offlineWarningShownRef.current = false;
      }

      // Process queued operations
      if (offlineQueueRef.current.length > 0 && isMountedRef.current) {
        const queued = [...offlineQueueRef.current];

        const toReplay = queued.slice(0, MAX_REPLAY_BATCH);
        const remaining = queued.slice(MAX_REPLAY_BATCH);

        offlineQueueRef.current = remaining;

        // Spread replay across event loop
        toReplay.forEach((op, index) => {
          const delay = Math.min(index * 10, MAX_QUEUE_SPACING);
          setTimeout(() => {
            if (isMountedRef.current) {
              processOperation(op);
            }
          }, delay);
        });

        toast.success('Changes synced!', {
          toastId: 'sync-success',
          autoClose: 2000
        });
      }

      return processOperation(operationToSend);
    },
    [isConnected, userId, canvasManager, options.maxOfflineQueueSize, options.showOfflineWarning, processOperation]
  );

  // Selection tracking
  useEffect(() => {
    if (!canvasManager || !options.enableSelectionTracking) return;

    const handleSelectionChange = () => {
      const selectedIds = canvasManager.getSelection?.() || [];
      trackOperation({
        type: 'selection:update',
        selectedIds,
      });
    };

    selectionHandlerRef.current = handleSelectionChange;
    canvasManager.on?.('selection:changed', handleSelectionChange);

    return () => {
      if (selectionHandlerRef.current) {
        canvasManager.off?.(
          'selection:changed',
          selectionHandlerRef.current
        );
      }
    };
  }, [canvasManager, options.enableSelectionTracking, trackOperation]);

  // Cursor tracking
  useEffect(() => {
    if (!canvasManager || !options.enableCursorTracking) return;

    let lastPosition = null;
    let lastSentTime = 0;

    const handleCursorMove = (position) => {
      const { worldX, worldY } = position;

      // Time-based throttling
      const now = Date.now();
      if (now - lastSentTime < options.cursorThrottleMs) {
        return;
      }

      // Distance-based filtering
      if (lastPosition) {
        const dx = worldX - lastPosition.worldX;
        const dy = worldY - lastPosition.worldY;

        if ((dx * dx + dy * dy) < minDeltaSquared) {
          return;
        }
      }

      lastPosition = { worldX, worldY };
      lastSentTime = now;

      trackOperation({
        type: 'cursor:move',
        position: { worldX, worldY },
      });
    };

    canvasManager.on?.('cursor:moved', handleCursorMove);

    return () => {
      canvasManager.off?.('cursor:moved', handleCursorMove);
    };
  }, [canvasManager, options.enableCursorTracking, options.cursorThrottleMs, minDeltaSquared, trackOperation]);

  // Batch operations
  const trackBatchOperations = useCallback(
    (operations) => {
      const version = canvasManager?.getVersion?.() ?? 1;
      const timestamp = Date.now();

      if (!isConnected) {
        operations.forEach((op) => {
          offlineQueueRef.current.push({
            ...op,
            userId,
            timestamp,
            version,
          });
        });

        while (offlineQueueRef.current.length > options.maxOfflineQueueSize) {
          offlineQueueRef.current.shift();
        }

        return true;
      }

      operations.forEach((op) => {
        if (isMountedRef.current) {
          sendCanvasOperation({
            ...op,
            userId,
            timestamp,
            version,
          });
        }
      });

      return true;
    },
    [isConnected, sendCanvasOperation, userId, canvasManager, options.maxOfflineQueueSize]
  );

  // Get user color
  const getUserColor = useCallback(
    (targetUserId) => {
      const user = users?.get?.(targetUserId);
      return user?.color || '#6B7280';
    },
    [users]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      Object.values(throttleTimersRef.current).forEach((timer) =>
        clearTimeout(timer)
      );

      if (drawingBatchTimerRef.current) {
        clearTimeout(drawingBatchTimerRef.current);
      }

      drawingBatchRef.current = [];
      pendingOpsRef.current = {};
    };
  }, []);

  return {
    trackOperation,
    trackBatchOperations,
    isConnected,
    getUserColor,
    users,
    hasOfflineChanges: offlineQueueRef.current.length > 0,
    flushDrawingBatch,
    decompressPoints,
  };
};