// src/canvas/commands/ImageCommands.js
import { BaseCommand } from '../history/BaseCommand';
import { generateId } from '@shared/lib/idGenerator';

export class AddImageCommand extends BaseCommand {
  constructor(imageObject) {
    super();
    this.imageObject = imageObject;
    this.objectId = imageObject?.id;
    this.operation = 'create';
  }

  execute(state) {

    const clamped = this.clampObject(this.imageObject);

    const imageToAdd = {
      ...this.imageObject,
      x: clamped.x,
      y: clamped.y,
    }
    // Add image to canvas state
    state.objects.push(imageToAdd);

    this.imageObject.x = clamped.x;
    this.imageObject.y = clamped.y;

    return state;
  }

  undo(state) {
    // Remove image from canvas
    const index = state.objects.findIndex(obj => obj.id === this.imageObject.id);
    if (index !== -1) {
      state.objects.splice(index, 1);
    }
    return state;
  }

  serialize() {
    return {
      ...super.serialize(),
      imageObject: this.imageObject,
    };
  }
}

export class ImageCommandFactory {

  static createImage(imageData, x, y, options = {}) {
    const imageObject = {
      id: generateId(),
      type: 'image',
      x: x,
      y: y,
      width: options.width || 100,
      height: options.height || 100,
      imageData: imageData, // Store the image data URL
      rotation: options.rotation || 0,
      opacity: options.opacity || 1,
      scaleX: options.scaleX || 1,
      scaleY: options.scaleY || 1,
      flipX: options.flipX || false,
      flipY: options.flipY || false,
      borderWidth: options.borderWidth || 0,
      borderColor: options.borderColor || '#000000',
      borderRadius: options.borderRadius || 0,
      imageStatus: options.imageStatus || 'loading',
      loaderVisibleUntil: options.loaderVisibleUntil || 0,
      layer: options.layer || 'default',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return new AddImageCommand(imageObject);
  }
}
