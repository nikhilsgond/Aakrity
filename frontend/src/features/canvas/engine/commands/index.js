// src/canvas/commands/index.js - For exporting all commands
import {
  PanViewportCommand,
  ZoomViewportCommand,
  ClearCanvasCommand,
  ResetViewportCommand
} from './ViewportCommands';

import {
  AddShapeCommand,
  ShapeCommandFactory
} from './ShapeCommands';

import {
  PencilCommand,
  PencilCommandFactory
} from './PencilCommands';

import {
  SelectObjectsCommand,
  DeselectObjectsCommand,
  SelectionCommandFactory,
  ClearSelectionCommand,
} from './SelectionCommands';

import {
  TextCommand,
  TextCommandFactory
} from './TextCommands';

import { CreateObjectsCommand, DeleteObjectsCommand } from './ObjectCommands';
import { ObjectTextCommand } from './ObjectTextCommand';

import { MoveCommand } from './MoveCommand';
import { ResizeCommand } from './ResizeCommand';
import { RotateCommand } from './RotateCommand';
import {
  ApplyEraserCommand,
  EraserCommandFactory,
} from './EraserCommands';
import { UpdateStyleCommand } from './UpdateStyleCommand';
import { LayerOrderCommand } from './LayerOrderCommand';

export {
  PanViewportCommand,
  ZoomViewportCommand,
  ClearCanvasCommand,
  ResetViewportCommand,
  AddShapeCommand,
  ShapeCommandFactory,
  PencilCommand,
  PencilCommandFactory,
  SelectObjectsCommand,
  DeselectObjectsCommand,
  SelectionCommandFactory,
  ClearSelectionCommand,
  TextCommand,
  TextCommandFactory,
  CreateObjectsCommand,
  DeleteObjectsCommand,
  ObjectTextCommand,
  MoveCommand,
  ResizeCommand,
  RotateCommand,
  ApplyEraserCommand,
  EraserCommandFactory,
  UpdateStyleCommand,
  LayerOrderCommand,
};

/**
 * Deserialize a command from its serialized form
 * @param {Object} data - Serialized command data with type and properties
 * @returns {Object} Deserialized command instance or null
 */
export const deserializeCommand = (data) => {
  if (!data || !data.type) {
    console.warn('Cannot deserialize command: missing type', data);
    return null;
  }

  try {
    switch (data.type) {
      case 'PanViewportCommand':
        return PanViewportCommand.deserialize(data);
      case 'ZoomViewportCommand':
        return ZoomViewportCommand.deserialize(data);
      case 'ClearCanvasCommand':
        return ClearCanvasCommand.deserialize(data);
      case 'ResetViewportCommand':
        return ResetViewportCommand.deserialize(data);
      case 'AddShapeCommand':
        return AddShapeCommand.deserialize(data);
      case 'PencilCommand':
        return PencilCommand.deserialize(data);
      case 'SelectObjectsCommand':
        return SelectObjectsCommand.deserialize(data);
      case 'DeselectObjectsCommand':
        return DeselectObjectsCommand.deserialize(data);
      case 'ClearSelectionCommand':
        return ClearSelectionCommand.deserialize(data);
      case 'TextCommand':
        return TextCommand.deserialize(data);
      case 'CreateObjectsCommand':
        return CreateObjectsCommand.deserialize(data);
      case 'DeleteObjectsCommand':
        return DeleteObjectsCommand.deserialize(data);
      case 'ObjectTextCommand':
        return ObjectTextCommand.deserialize(data);
      case 'MoveCommand':
        return MoveCommand.deserialize(data);
      case 'ResizeCommand':
        return ResizeCommand.deserialize(data);
      case 'RotateCommand':
        return RotateCommand.deserialize(data);
      case 'ApplyEraserCommand':
        return ApplyEraserCommand.deserialize(data);
      case 'UpdateStyleCommand':
        return UpdateStyleCommand.deserialize(data);
      case 'LayerOrderCommand':
        return LayerOrderCommand.deserialize(data);
      default:
        console.warn('Unknown command type:', data.type);
        return null;
    }
  } catch (error) {
    console.error('Error deserializing command:', error);
    return null;
  }
};
