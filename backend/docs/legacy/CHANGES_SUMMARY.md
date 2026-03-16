## Changes Summary

### 1. Created New Component: FloatingOptions.jsx
**Location:** `src/components/canvas/FloatingOptions.jsx`

**Purpose:** Handles all floating toolbar logic including:
- Position calculation for the floating toolbar
- Toolbar visibility and positioning based on object state
- **NEW:** Disappear/reappear effect when switching between objects (150ms hide duration for visual feedback)
- Hiding during viewport changes, panning, and object moves
- Rendering appropriate toolbar based on object type

**Key Features:**
- Uses `previousObjectIdRef` to detect when user switches between different selected objects
- Adds a 150ms "hide and show" transition when switching to create smooth visual feedback
- Continues all existing functionality (position calculation, event handling, etc.)

### 2. Refactored: FloatingToolbarManager.jsx
**Location:** `src/components/canvas/FloatingToolbarManager.jsx`

**Changes:**
- Simplified from 250+ lines to ~40 lines
- Now only handles selection tracking
- Delegates all positioning and rendering to the new `FloatingOptions` component
- Listens for `selection:changed` events and tracks the currently selected object(s)
- Passes selected object to FloatingOptions for display

**Benefits:**
- Better separation of concerns
- Much cleaner and more maintainable code
- Easier to modify toolbar behavior in one place

### 3. Selection Clearing (Already Implemented)
**Location:** `src/canvas/tools/select/SelectTool.js`

**Existing Feature:** When clicking on empty canvas:
- If NOT using multi-select (Shift/Ctrl/Cmd):
  - Selection is cleared via `selectionManager.clear()`
  - Canvas is re-rendered
- This automatically triggers `selection:changed` event
- FloatingToolbarManager sees empty selection and sets `selectedObject` to null
- FloatingOptions returns null (no toolbar shown)

### How It Works End-to-End:

1. **User clicks on empty canvas:**
   - SelectTool.onPointerDown() detects no objects hit
   - Calls `selectionManager.clear()`
   - Triggers `selection:changed` event
   - FloatingToolbarManager sets `selectedObject` to null
   - FloatingOptions doesn't render

2. **User clicks on an object:**
   - SelectTool.onPointerDown() hits the object
   - Calls `selectionManager.set([objectId])`
   - Triggers `selection:changed` event
   - FloatingToolbarManager gets the object
   - FloatingOptions displays toolbar above object

3. **User switches to different object (while first object is selected):**
   - SelectTool detects new object
   - Triggers `selection:changed` event
   - FloatingToolbarManager updates `selectedObject`
   - FloatingOptions detects object ID changed (previous !== current)
   - Hides toolbar (setShowToolbar(false))
   - After 150ms, shows toolbar again (setShowToolbar(true))
   - This creates smooth "disappear and reappear" effect

4. **Toolbar hides during:**
   - Viewport changes (zoom/pan)
   - Object movement/transformation
   - Panning
   - Canvas resize
   - Object is off-screen

### Testing Checklist:
- [ ] Click on empty canvas → toolbar disappears
- [ ] Click on object → toolbar appears above object
- [ ] Switch between objects → toolbar disappears then reappears near new object
- [ ] Drag object → toolbar disappears during drag, reappears when done
- [ ] Zoom/Pan → toolbar disappears and recalculates position
- [ ] Multiple objects selected → toolbar hidden (only shows for single object)
