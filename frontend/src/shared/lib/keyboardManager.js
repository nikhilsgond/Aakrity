// src/utils/KeyboardManager.js
export default class KeyboardManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  enable() {
    window.addEventListener("keydown", this.handleKeyDown);
  }

  disable() {
    window.removeEventListener("keydown", this.handleKeyDown);
  }

  handleKeyDown(e) {
    // Only handle Delete/Backspace
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      
      const activeObject = this.canvas.getActiveObject();
      if (!activeObject) return;
      
      console.log("KeyboardManager: Deleting", activeObject.type);
      
      if (activeObject.type === 'activeSelection') {
        const objects = activeObject.getObjects();
        // Discard selection first
        this.canvas.discardActiveObject();
        // Delete objects
        objects.forEach(obj => {
          this.canvas.remove(obj);
        });
      } else {
        this.canvas.remove(activeObject);
        this.canvas.discardActiveObject();
      }
      
      this.canvas.requestRenderAll();
    }
  }
}