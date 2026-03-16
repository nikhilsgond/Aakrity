
// src/canvas/commands/TextCommand.js
import { BaseCommand } from '../history/BaseCommand';
import { generateId } from '@shared/lib/idGenerator';

export class TextCommand extends BaseCommand {
    constructor(textObject, action = 'add') {
        super();
        this.textObject = textObject;
        this.action = action; // 'add', 'modify', 'delete'
        this.previousState = null; // For modify/undo
        this.previousText = null;
        this.nextText = null;
        this.operation = action === 'modify' ? 'text_update' : action;
        this.objectId = textObject?.id;
    }

    execute(state) {
        switch (this.action) {
            case 'add':
                // Idempotency check — don't add if an object with this ID already exists.
                // This guards against double-creation when both a command and an explicit
                // add/modify operation arrive from the same remote broadcast.
                if (state.objects.some(obj => obj.id === this.textObject.id)) {
                    console.warn(`TextCommand: object ${this.textObject.id} already exists, skipping add`);
                    return state;
                }
                // Add text to canvas
                state.objects.push(this.textObject);
                break;

            case 'modify': {
                // Find and update text object
                const index = state.objects.findIndex(obj => obj.id === this.textObject.id);
                if (index !== -1) {
                    // Deep-clone to protect nested structures like formattedRanges
                    this.previousState = JSON.parse(JSON.stringify(state.objects[index]));
                    this.previousText = this.previousState?.text ?? '';
                    this.nextText = this.textObject?.text ?? '';
                    state.objects[index] = { ...this.textObject };
                }
                break;
            }

            case 'delete': {
                // Remove text from canvas
                const delIndex = state.objects.findIndex(obj => obj.id === this.textObject.id);
                if (delIndex !== -1) {
                    this.previousState = JSON.parse(JSON.stringify(state.objects[delIndex]));
                    state.objects.splice(delIndex, 1);
                }
                break;
            }
        }

        return state;
    }

    undo(state) {
        switch (this.action) {
            case 'add': {
                // Remove added text
                const addIndex = state.objects.findIndex(obj => obj.id === this.textObject.id);
                if (addIndex !== -1) {
                    state.objects.splice(addIndex, 1);
                }
                break;
            }

            case 'modify': {
                // Restore previous state (deep-clone to prevent mutation)
                if (this.previousState) {
                    const modIndex = state.objects.findIndex(obj => obj.id === this.textObject.id);
                    if (modIndex !== -1) {
                        state.objects[modIndex] = JSON.parse(JSON.stringify(this.previousState));
                    }
                }
                break;
            }

            case 'delete': {
                // Restore deleted text (deep-clone)
                if (this.previousState) {
                    state.objects.push(JSON.parse(JSON.stringify(this.previousState)));
                }
                break;
            }
        }

        return state;
    }

    serialize() {
        return {
            ...super.serialize(),
            textObject: this.textObject,
            action: this.action,
            previousState: this.previousState,
            previousText: this.previousText,
            nextText: this.nextText,
        };
    }

    static deserialize(data) {
        const command = new TextCommand(data.textObject, data.action);
        command.id = data.id;
        command.timestamp = data.timestamp;
        command.userId = data.userId;
        command.previousState = data.previousState;
        command.previousText = data.previousText ?? null;
        command.nextText = data.nextText ?? null;
        command.operation = data.operation || (data.action === 'modify' ? 'text_update' : data.action);
        command.objectId = data.textObject?.id || data.objectId;
        return command;
    }
}


export class TextCommandFactory {
    static createText(text, x, y, options = {}) {
        const textObject = {
            id: generateId(),
            type: 'text',
            x: x,
            y: y,
            text: text || '',
            placeholder: options.placeholder || 'Type something...',
            placeholderColor: options.placeholderColor || '#9CA3AF',
            placeholderOpacity: options.placeholderOpacity || 0.5,
            fontFamily: options.fontFamily || 'Arial, sans-serif',
            fontSize: options.fontSize || 16,
            textColor: options.color || '#000000',
            backgroundColor: options.backgroundColor || 'transparent',
            textAlign: options.textAlign || 'left', // Make sure this is included
            verticalAlign: options.verticalAlign || 'top',
            fontWeight: options.fontWeight || 'normal',
            fontStyle: options.fontStyle || 'normal',
            underline: options.underline || false,
            strikethrough: options.strikethrough || false,
            listType: options.listType || 'none',
            autoWidth: options.autoWidth !== false,
            autoHeight: options.autoHeight !== false,
            width: options.width || 200,
            height: options.height || 50,
            rotation: options.rotation || 0,
            opacity: options.opacity || 1,
            layer: options.layer || 'default',
            isEditing: false,
            lockedBy: null,
            isTempPlaceholder: !!options.isTempPlaceholder,
            formattedRanges: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        return new TextCommand(textObject, 'add');
    }

    static modifyText(textObject, newProperties) {
        const updatedTextObject = {
            ...textObject,
            ...newProperties,
            updatedAt: Date.now(),
        };

        return new TextCommand(updatedTextObject, 'modify');
    }

    static deleteText(textObject) {
        return new TextCommand(textObject, 'delete');
    }
}
