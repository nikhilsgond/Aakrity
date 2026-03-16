export default class SelectionManager {
    constructor() {
        this.selectedIds = new Set();
        this.mode = 'idle';

        this.marquee = {
            active: false,
            start: null,
            current: null
        };

        this.drag = {
            active: false,
            start: null,
            current: null
        };

        this.listeners = [];

        // NEW: Callback for requesting canvas render
        this.renderCallback = null;
    }

    // NEW: Set render callback (called by CanvasManager or useCanvas)
    setRenderCallback(callback) {
        this.renderCallback = callback;
    }

    // NEW: Request render via callback
    requestRender() {
        if (this.renderCallback) {
            this.renderCallback();
        }
    }

    // ========== Selection State ==========
    select(id, additive = false) {
        if (!additive) {
            this.selectedIds.clear();
        }
        if (id) {
            this.selectedIds.add(id);
        }
        this.emit();
        this.requestRender(); // NEW: Trigger render on selection change
    }

    deselect(id) {
        this.selectedIds.delete(id);
        this.emit();
        this.requestRender(); // NEW: Trigger render on selection change
    }

    clear() {
        this.selectedIds.clear();
        this.emit();
        this.requestRender(); // NEW: Trigger render on selection change
    }

    set(ids = []) {
        this.selectedIds = new Set(ids);
        this.emit();
        this.requestRender(); // NEW: Trigger render on selection change
    }

    toggle(id) {
        if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id);
        } else {
            this.selectedIds.add(id);
        }
        this.emit();
        this.requestRender(); // NEW: Trigger render on selection change
    }

    isSelected(id) {
        return this.selectedIds.has(id);
    }

    getSelectedIds() {
        return Array.from(this.selectedIds);
    }

    hasSelection() {
        return this.selectedIds.size > 0;
    }

    // ========== Mode Tracking ==========
    setMode(mode) {
        if (this.mode === mode) return;
        this.mode = mode;
        this.emit();
    }

    getMode() {
        return this.mode;
    }

    isMode(mode) {
        return this.mode === mode;
    }

    // ========== Marquee State ==========
    startMarquee(point) {
        this.marquee.active = true;
        this.marquee.start = point;
        this.marquee.current = point;
        this.setMode('marquee');
    }

    updateMarquee(point) {
        if (!this.marquee.active) return;
        this.marquee.current = point;
        this.emit();
    }

    endMarquee() {
        this.marquee.active = false;
        this.marquee.start = null;
        this.marquee.current = null;
        this.setMode('idle');
    }

    getMarqueeRect() {
        if (!this.marquee.active || !this.marquee.start) return null;

        const start = this.marquee.start;
        const current = this.marquee.current;

        return {
            x: Math.min(start.x, current.x),
            y: Math.min(start.y, current.y),
            width: Math.abs(current.x - start.x),
            height: Math.abs(current.y - start.y)
        };
    }

    isMarqueeActive() {
        return this.marquee.active;
    }

    // ========== Drag Tracking ==========
    startDrag(point) {
        this.drag.active = true;
        this.drag.start = point;
        this.drag.current = point;
        this.emit();
    }

    updateDrag(point) {
        if (!this.drag.active) return;
        this.drag.current = point;
        this.emit();
    }

    endDrag() {
        this.drag.active = false;
        this.drag.start = null;
        this.drag.current = null;
        this.emit();
    }

    getDragDelta() {
        if (!this.drag.active || !this.drag.start || !this.drag.current) {
            return { x: 0, y: 0 };
        }
        return {
            x: this.drag.current.x - this.drag.start.x,
            y: this.drag.current.y - this.drag.start.y
        };
    }

    // ========== Group Awareness ==========
    // Note: This mutates selection - only call when committing changes
    normalizeSelection(objectMap) {
        const normalized = new Set();

        for (const id of this.selectedIds) {
            const obj = objectMap.get(id);
            if (!obj) continue;

            let skip = false;
            let current = obj;
            while (current.parentId) {
                current = objectMap.get(current.parentId);
                if (current && this.selectedIds.has(current.id)) {
                    skip = true;
                    break;
                }
            }

            if (!skip) {
                normalized.add(id);
            }
        }

        this.selectedIds = normalized;
        this.emit();
        this.requestRender(); // NEW: Trigger render after normalization
    }

    // ========== Events ==========
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    unsubscribe(listener) {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    emit() {
        const state = {
            selectedIds: this.getSelectedIds(),
            mode: this.mode,
            marquee: this.marquee.active ? this.getMarqueeRect() : null,
            drag: this.drag.active ? this.getDragDelta() : null,
            hasSelection: this.hasSelection()
        };

        this.listeners.forEach(listener => listener(state));
    }
}