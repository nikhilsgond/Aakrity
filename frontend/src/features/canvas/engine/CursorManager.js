/**
 * CursorManager — World-coordinate based cursor system (Miro-style).
 *
 * Responsibilities:
 *  1. Track local pointer → world coordinates → throttled socket broadcast
 *  2. Receive remote cursors (world coords) → interpolate → render via DOM transform
 *  3. Respond to viewport changes (re-project all cursors, never re-broadcast)
 *
 * Architecture rules:
 *  - Cursors are stored in WORLD coordinates only (worldX, worldY)
 *  - Screen position is derived: screenX = worldX * zoom + panX
 *  - Cursor DOM uses `transform: translate(px, px)` — no `left/top`, no `scale()`
 *  - DOM elements are pooled (created once, reused) — never innerHTML per frame
 *  - Interpolation: current += (target - current) * LERP_FACTOR per rAF
 *  - Broadcast throttled to BROADCAST_INTERVAL_MS (50ms)
 *  - No React state involved — zero re-renders
 *
 * Bug #13: Tool-aware cursor icons — each tool broadcasts its active tool name.
 *   Remote cursors render a matching icon (pencil, eraser, select arrow, shapes, etc.)
 *
 * Bug #14: Cursor freeze on UI hover — instead of sending off-screen coordinates
 *   when the pointer leaves the canvas, we freeze the last known position so remote
 *   users still see the cursor at the point where it was last on canvas.
 *   Cursor disappears only when the user hasn't moved for > FREEZE_HIDE_MS.
 */

const LERP_FACTOR = 0.25;
const BROADCAST_INTERVAL_MS = 50;

/** #14: How long with no position update before hiding a frozen cursor (ms) */
const FREEZE_HIDE_MS = 8000;

/** #13: Tool state → cursor icon mapping */
const TOOL_ICON_SVG = {
  pencil: (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="${color}" stroke="white" stroke-width="1.2"/>
    <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="${color}" stroke="white" stroke-width="1.2"/>
  </svg>`,
  eraser: (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))">
    <path d="M16.24 3.56l4.24 4.24-9.9 9.9-4.24-4.24 9.9-9.9z" fill="${color}" stroke="white" stroke-width="1"/>
    <path d="M4 20h16" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M6.34 17.66l3.9-3.9" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`,
  'object-eraser': (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="${color}" opacity="0.3" stroke="white" stroke-width="1"/>
    <path d="M8 12h8M12 8v8" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="4" stroke="white" stroke-width="1.5"/>
  </svg>`,
  text: (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))">
    <path d="M4 7V4h16v3" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <path d="M9 20h6" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 4v16" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  shape: (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))">
    <rect x="3" y="3" width="8" height="8" rx="1" fill="${color}" stroke="white" stroke-width="1.2"/>
    <circle cx="17" cy="7" r="4" fill="${color}" stroke="white" stroke-width="1.2"/>
    <path d="M3 21l5-9 5 9H3z" fill="${color}" stroke="white" stroke-width="1.2"/>
    <rect x="13" y="13" width="8" height="8" rx="1" fill="${color}" stroke="white" stroke-width="1.2"/>
  </svg>`,
  image: (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="${color}" opacity="0.5" stroke="white" stroke-width="1.2"/>
    <path d="M3 15l5-5 4 4 3-3 6 6" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="8" cy="8" r="2" fill="white"/>
  </svg>`,
  emoji: (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))">
    <circle cx="12" cy="12" r="9" fill="${color}" stroke="white" stroke-width="1.2"/>
    <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
    <circle cx="9" cy="10" r="1" fill="white"/>
    <circle cx="15" cy="10" r="1" fill="white"/>
  </svg>`,
  sticky: (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))">
    <path d="M4 4h16v12l-4 4H4V4z" fill="${color}" opacity="0.6" stroke="white" stroke-width="1.2"/>
    <path d="M16 16v4l4-4h-4z" fill="${color}" stroke="white" stroke-width="1"/>
    <path d="M8 9h8M8 12h5" stroke="white" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`,
  connector: (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))">
    <circle cx="5" cy="12" r="3" fill="${color}" stroke="white" stroke-width="1.2"/>
    <circle cx="19" cy="12" r="3" fill="${color}" stroke="white" stroke-width="1.2"/>
    <path d="M8 12h8" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <path d="M16 10l2 2-2 2" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  pan: (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))">
    <path d="M9 11V6a2 2 0 0 1 4 0v5M9 11v3a4 4 0 0 0 8 0v-3M9 11H7a2 2 0 0 0-2 2v1a6 6 0 0 0 12 0v-1a2 2 0 0 0-2-2h-2" fill="${color}" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  fill: (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))">
    <path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15a1.49 1.49 0 0 0 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12z" fill="${color}" stroke="white" stroke-width="1"/>
    <path d="M20 13c0 2.6-3 6-3 6s-3-3.4-3-6a3 3 0 0 1 6 0z" fill="${color}" stroke="white" stroke-width="1"/>
  </svg>`,
  select: (color) => null,   // falls back to default arrow
  editing: (color) => null,  // handled separately
};

export class CursorManager {
  /**
   * @param {Object} options
   * @param {Function} options.getViewport - () => { zoom, panX, panY }
   * @param {Function} options.broadcastCursor - (worldX, worldY, tool?) => void
   * @param {Function} options.getLocalUserId - () => string
   */
  constructor(options = {}) {
    this.getViewport = options.getViewport || (() => ({ zoom: 1, panX: 0, panY: 0 }));
    this.broadcastCursor = options.broadcastCursor || (() => {});
    this.getLocalUserId = options.getLocalUserId || (() => null);

    /** @type {Map<string, RemoteCursor>} userId → cursor state */
    this.cursors = new Map();

    /** @type {HTMLDivElement|null} overlay container */
    this.overlay = null;

    /** @type {HTMLCanvasElement|null} */
    this.canvas = null;

    /** @type {number|null} rAF id */
    this._rafId = null;

    /** @type {boolean} */
    this._mounted = false;

    // Local cursor throttling
    this._lastBroadcastTime = -Infinity;
    this._pendingBroadcast = null;
    this._broadcastTimer = null;

    // #14: Last known valid canvas position (for freeze-on-leave)
    this._lastCanvasWorldX = null;
    this._lastCanvasWorldY = null;

    // #13: Current local tool state
    this._localTool = 'select';

    // Bound methods
    this._tick = this._tick.bind(this);
  }

  /* ============================================================
     LIFECYCLE
     ============================================================ */

  /**
   * Mount the cursor overlay on top of the canvas container.
   * @param {HTMLCanvasElement} canvas
   */
  mount(canvas) {
    if (!canvas) return;
    this.canvas = canvas;
    const container = canvas.parentElement;
    if (!container) return;

    // Create overlay div
    this.overlay = document.createElement('div');
    this.overlay.className = 'cursor-overlay';
    Object.assign(this.overlay.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '1000',
      overflow: 'hidden',
    });
    container.appendChild(this.overlay);

    this._mounted = true;
    this._startLoop();
  }

  /**
   * Unmount overlay + stop rAF loop + clear all cursor DOM.
   */
  destroy() {
    this._mounted = false;
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._broadcastTimer != null) {
      clearTimeout(this._broadcastTimer);
      this._broadcastTimer = null;
    }
    // Remove cursor DOM elements
    this.cursors.forEach(c => c.el?.remove());
    this.cursors.clear();
    // Remove overlay
    if (this.overlay?.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.canvas = null;
  }

  /* ============================================================
     LOCAL POINTER TRACKING
     ============================================================ */

  /**
   * Called on pointermove. Converts client coords → world, broadcasts throttled.
   * @param {PointerEvent|MouseEvent} e
   */
  handlePointerMove(e) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Ignore outside canvas
    if (screenX < 0 || screenX > rect.width || screenY < 0 || screenY > rect.height) {
      // #14: Pointer moved OUTSIDE canvas area → do NOT broadcast off-screen sentinel:
      // freeze at last canvas position. Nothing to update.
      return;
    }

    const vp = this.getViewport();
    const worldX = (screenX - vp.panX) / vp.zoom;
    const worldY = (screenY - vp.panY) / vp.zoom;

    // #14: Record last valid canvas position
    this._lastCanvasWorldX = worldX;
    this._lastCanvasWorldY = worldY;

    this._throttleBroadcast(worldX, worldY, this._localTool);
  }

  /**
   * Called when pointer exits the canvas container.
   * Bug #14: Instead of sending off-screen sentinel, freeze at last position.
   */
  handlePointerLeave() {
    // #14: Do nothing. The remote cursor stays at the last canvas position.
    // It will auto-hide after FREEZE_HIDE_MS of no updates.
  }

  /**
   * Bug #13: Update the locally active tool — triggers a re-broadcast if position is known.
   * @param {string} toolName
   */
  setLocalTool(toolName) {
    if (toolName === this._localTool) return;
    this._localTool = toolName || 'select';
    // Re-broadcast immediately so the change is reflected on remote clients right away
    if (this._lastCanvasWorldX !== null) {
      this._throttleBroadcast(this._lastCanvasWorldX, this._lastCanvasWorldY, this._localTool);
    }
  }

  /**
   * Throttle broadcast to BROADCAST_INTERVAL_MS.
   */
  _throttleBroadcast(worldX, worldY, tool) {
    const now = Date.now();
    const elapsed = now - this._lastBroadcastTime;

    if (elapsed >= BROADCAST_INTERVAL_MS) {
      this._lastBroadcastTime = now;
      this.broadcastCursor(worldX, worldY, tool);
      if (this._broadcastTimer != null) {
        clearTimeout(this._broadcastTimer);
        this._broadcastTimer = null;
      }
    } else {
      // Schedule trailing emit
      this._pendingBroadcast = { worldX, worldY, tool };
      if (this._broadcastTimer == null) {
        this._broadcastTimer = setTimeout(() => {
          this._broadcastTimer = null;
          if (this._pendingBroadcast) {
            this._lastBroadcastTime = Date.now();
            const pb = this._pendingBroadcast;
            this.broadcastCursor(pb.worldX, pb.worldY, pb.tool);
            this._pendingBroadcast = null;
          }
        }, BROADCAST_INTERVAL_MS - elapsed);
      }
    }
  }

  /* ============================================================
     REMOTE CURSOR UPDATES
     ============================================================ */

  /**
   * Receive a remote cursor position update (world coordinates).
   * @param {string} userId
   * @param {number} worldX
   * @param {number} worldY
   * @param {Object} userInfo - { name, color, state, tool }
   */
  updateRemoteCursor(userId, worldX, worldY, userInfo = {}) {
    const localId = this.getLocalUserId();
    if (userId === localId) return; // skip self

    let cursor = this.cursors.get(userId);
    if (!cursor) {
      cursor = this._createCursorEntry(userId, userInfo);
      this.cursors.set(userId, cursor);
    }

    // Update target + user info
    cursor.targetWorldX = worldX;
    cursor.targetWorldY = worldY;
    if (userInfo.name) cursor.name = userInfo.name;
    if (userInfo.color) cursor.color = userInfo.color;
    if (userInfo.state) cursor.state = userInfo.state;
    // #13: Update tool
    if (userInfo.tool !== undefined) cursor.tool = userInfo.tool || 'select';

    // #14: Track last-update timestamp for freeze-hide logic
    cursor.lastUpdateAt = Date.now();

    // If cursor just appeared, snap immediately (no lerp from 0,0)
    if (!cursor.initialized) {
      cursor.currentWorldX = worldX;
      cursor.currentWorldY = worldY;
      cursor.initialized = true;
    }

    // Update label/svg if color, name, state, or tool changed
    this._updateCursorAppearance(cursor);
  }

  /**
   * Remove a remote cursor (user left / disconnected).
   * @param {string} userId
   */
  removeRemoteCursor(userId) {
    const cursor = this.cursors.get(userId);
    if (cursor) {
      cursor.el?.remove();
      this.cursors.delete(userId);
    }
  }

  /* ============================================================
     RENDER LOOP (rAF)
     ============================================================ */

  _startLoop() {
    if (this._rafId != null) return;
    this._rafId = requestAnimationFrame(this._tick);
  }

  _tick() {
    if (!this._mounted) return;

    const vp = this.getViewport();
    const now = Date.now();

    this.cursors.forEach(cursor => {
      // #14: Auto-hide frozen cursors that haven't updated for a long time
      if (cursor.lastUpdateAt && now - cursor.lastUpdateAt > FREEZE_HIDE_MS) {
        if (cursor.el) cursor.el.style.display = 'none';
        return; // skip further processing
      }

      // Interpolate world position
      cursor.currentWorldX += (cursor.targetWorldX - cursor.currentWorldX) * LERP_FACTOR;
      cursor.currentWorldY += (cursor.targetWorldY - cursor.currentWorldY) * LERP_FACTOR;

      // World → screen
      const screenX = cursor.currentWorldX * vp.zoom + vp.panX;
      const screenY = cursor.currentWorldY * vp.zoom + vp.panY;

      // Check visibility (allow some margin)
      const canvasRect = this.canvas?.getBoundingClientRect();
      const w = canvasRect?.width ?? 2000;
      const h = canvasRect?.height ?? 2000;
      // #14: wider off-screen tolerance so cursor remains visible if just outside canvas edge
      const offScreen = screenX < -200 || screenX > w + 200 || screenY < -200 || screenY > h + 200;

      if (cursor.el) {
        cursor.el.style.display = offScreen ? 'none' : '';
        if (!offScreen) {
          cursor.el.style.transform = `translate(${screenX}px, ${screenY}px)`;
        }
      }
    });

    this._rafId = requestAnimationFrame(this._tick);
  }

  /* ============================================================
     VIEWPORT CHANGE
     ============================================================ */

  /**
   * Called on zoom/pan. Re-projects cursors on next tick — no state mutation needed.
   * The rAF loop already reads the live viewport, so this is effectively a no-op.
   * Kept as an explicit hook for the integration layer.
   */
  onViewportChanged() {
    // No-op: the rAF tick reads viewport each frame.
  }

  /* ============================================================
     DOM CURSOR ELEMENTS (POOLED)
     ============================================================ */

  _createCursorEntry(userId, userInfo) {
    const el = document.createElement('div');
    el.className = 'remote-cursor';
    el.setAttribute('data-user-id', userId);
    Object.assign(el.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      willChange: 'transform',
      // No transition — interpolation handles smoothness
    });

    const name = userInfo.name || 'Anonymous';
    const color = userInfo.color || '#FF4444';
    const state = userInfo.state || 'idle';
    const tool = userInfo.tool || 'select';

    el.innerHTML = this._cursorHTML(name, color, state, tool);

    if (this.overlay) {
      this.overlay.appendChild(el);
    }

    return {
      userId,
      name,
      color,
      state,
      tool,
      el,
      targetWorldX: 0,
      targetWorldY: 0,
      currentWorldX: 0,
      currentWorldY: 0,
      initialized: false,
      lastUpdateAt: Date.now(),
    };
  }

  /** #13: Generate tool-specific SVG cursor icon */
  _cursorHTML(name, color, state, tool = 'select') {
    const isEditing = state === 'editing';

    let cursorSvg;

    if (isEditing) {
      // Text-editing state takes priority (I-beam cursor)
      cursorSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
        <rect x="10" y="2" width="4" height="20" rx="1" fill="${color}" stroke="white" stroke-width="1"/>
        <rect x="6" y="2" width="12" height="3" rx="1" fill="${color}" stroke="white" stroke-width="0.5"/>
        <rect x="6" y="19" width="12" height="3" rx="1" fill="${color}" stroke="white" stroke-width="0.5"/>
      </svg>`;
    } else {
      // Look up tool-specific SVG; fall back to default arrow
      const toolIconFn = TOOL_ICON_SVG[tool];
      const toolSvg = toolIconFn ? toolIconFn(color) : null;
      if (toolSvg) {
        cursorSvg = toolSvg;
      } else {
        // Default: cursor arrow
        cursorSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
          <path d="M3 3L10 21L12.5 13.5L20 11L3 3Z" fill="${color}" stroke="white" stroke-width="1.5"/>
        </svg>`;
      }
    }

    const toolLabel = isEditing
      ? ' ✏️'
      : tool && tool !== 'select'
        ? ` (${tool})`
        : '';

    return `${cursorSvg}<div style="
      position: absolute;
      top: 20px;
      left: 10px;
      background: ${color};
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      border: 1px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      pointer-events: none;
    ">${name}${toolLabel}</div>`;
  }

  _updateCursorAppearance(cursor) {
    if (!cursor.el) return;
    // Only rebuild inner HTML if appearance changed
    const key = `${cursor.name}|${cursor.color}|${cursor.state}|${cursor.tool || 'select'}`;
    if (cursor._lastAppearanceKey === key) return;
    cursor._lastAppearanceKey = key;
    cursor.el.innerHTML = this._cursorHTML(cursor.name, cursor.color, cursor.state, cursor.tool);
  }
}

export default CursorManager;
