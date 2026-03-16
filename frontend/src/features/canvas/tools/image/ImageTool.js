// src/canvas/tools/image/ImageTool.js
import { ImageCommandFactory } from '../../engine/commands/ImageCommands';
import { useUIStore } from '@app/state/uiStore';

const PREVIEW_SIZE = { width: 240, height: 160 };
const LOADER_MIN_MS = 220;
const MAX_IMAGE_FILE_SIZE = 25 * 1024 * 1024;

export default class ImageTool {
  constructor(options = {}) {
    this.name = 'image';
    this.toolType = 'image';
    this.cursor = 'crosshair';
    this.canvasManager = null;

    this.options = {
      opacity: options.opacity ?? 1,
      borderWidth: options.borderWidth ?? 0,
      borderColor: options.borderColor ?? '#000000',
      borderRadius: options.borderRadius ?? 0,
    };

    this.currentImageId = null;
    this.pendingImageData = null;
    this.openOnActivate = false;
  }

  getCursor() {
    return this.cursor;
  }

  attachCanvas(canvasManager) {
    this.canvasManager = canvasManager;
  }

  setOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }

  activate(canvasManager, toolOptions) {
    this.canvasManager = canvasManager;
    if (toolOptions) {
      this.setOptions(toolOptions);
    }
    if (this.openOnActivate) {
      this.openOnActivate = false;
      this.openImagePicker();
    }
  }

  deactivate() {
    this.pendingImageData = null;
    this.currentImageId = null;
  }

  requestOpenPicker() {
    this.openOnActivate = true;
  }

  openImagePicker() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.position = 'fixed';
    fileInput.style.left = '-9999px';
    fileInput.style.top = '-9999px';
    document.body.appendChild(fileInput);

    let pickerResolved = false;
    let fallbackTimer = null;

    const cleanup = () => {
      window.removeEventListener('focus', onWindowFocus);
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (fileInput.parentNode) {
        fileInput.parentNode.removeChild(fileInput);
      }
    };

    const resolveNoFile = () => {
      if (pickerResolved) return;
      pickerResolved = true;
      cleanup();
      this._revertToSelectTool();
    };

    fileInput.onchange = (e) => {
      if (pickerResolved) return;
      pickerResolved = true;
      cleanup();
      const file = e.target.files?.[0];
      if (!file) {
        this._revertToSelectTool();
        return;
      }
      this.handleImageFile(file);
    };

    fileInput.oncancel = resolveNoFile;
    fileInput.addEventListener('cancel', resolveNoFile);

    const onWindowFocus = () => {
      setTimeout(() => {
        resolveNoFile();
      }, 250);
    };
    window.addEventListener('focus', onWindowFocus);

    // Some browsers do not fire cancel/focus consistently. This watchdog
    // ensures we still leave image mode when no file is chosen.
    fallbackTimer = setTimeout(() => {
      resolveNoFile();
    }, 2000);

    fileInput.click();
  }

  _revertToSelectTool() {
    if (!this.canvasManager?.toolManager) return;

    try {
      this.canvasManager.toolManager.setActiveTool('select');
    } catch {
      const selectTool = this.canvasManager.toolManager.getToolInstance('select');
      if (selectTool) {
        this.canvasManager.setActiveTool(selectTool);
      }
    }

    this.canvasManager.emit('tool:changed', { toolType: 'select' });
  }

  handleImageFile(file, options = {}) {
    if (!this.canvasManager || !file) return;

    if (!this.isValidImageFile(file)) {
      this.notifyError('Only image files are supported.', 'Unsupported file type');
      this._revertToSelectTool();
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      this.notifyError('Image is too large. Maximum supported size is 25 MB.', 'Upload failed');
      this._revertToSelectTool();
      return;
    }

    const worldPos = this.getInsertWorldPosition(options.screenPoint || null);
    this.showLoadingPreview(worldPos);

    const reader = new FileReader();
    reader.onload = (event) => {
      this.pendingImageData = event.target?.result;
      this.canvasManager.clearPreview();

      // EMIT event with raw data - let hook handle execution
      this.canvasManager.emit('tool:image:ready', {
        imageData: this.pendingImageData,
        worldPos,
        options: { ...this.options },
        tool: this
      });
    };

    reader.onerror = () => {
      this.canvasManager.clearPreview();
      this.notifyError('Failed to read the selected file.');
      this._revertToSelectTool();
    };

    reader.readAsDataURL(file);
  }

  isValidImageFile(file) {
    if (!file) return false;
    if (typeof file.type === 'string' && /^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      return true;
    }
    return /\.(png|jpe?g|webp)$/i.test(file.name || '');
  }

  getInsertWorldPosition(screenPoint = null) {
    const rect = this.canvasManager.canvas.getBoundingClientRect();
    const screenX = screenPoint?.x ?? rect.width / 2;
    const screenY = screenPoint?.y ?? rect.height / 2;
    return this.canvasManager.screenToWorld(screenX, screenY);
  }

  showLoadingPreview(worldPos) {
    this.canvasManager.setPreviewObject({
      id: `image-preview-${Date.now()}`,
      type: 'image',
      x: worldPos.x - PREVIEW_SIZE.width / 2,
      y: worldPos.y - PREVIEW_SIZE.height / 2,
      width: PREVIEW_SIZE.width,
      height: PREVIEW_SIZE.height,
      imageData: null,
      imageStatus: 'loading',
      opacity: this.options.opacity,
      borderWidth: this.options.borderWidth,
      borderColor: this.options.borderColor,
      borderRadius: this.options.borderRadius,
      loaderVisibleUntil: Date.now() + LOADER_MIN_MS,
      isPreview: true,
    });
  }

  notifyError(message, title = 'Upload failed') {
    try {
      useUIStore.getState().pushNotification({
        type: 'error',
        title,
        message,
      });
    } catch (e) {
      console.error('Failed to show notification:', e);
    }
  }

  // No pointer events needed - image tool doesn't draw
  onPointerDown() { return null; }
  onPointerMove() { return null; }
  onPointerUp() { return null; }
}