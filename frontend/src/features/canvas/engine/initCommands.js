// This file TELLS THE SYSTEM about all available commands
import { registerCommand } from './history';
import { PanViewportCommand, ZoomViewportCommand, ClearCanvasCommand } from './commands/ViewportCommands';
import { AddShapeCommand } from './commands/ShapeCommands';
import { PencilCommand } from './commands/PencilCommands';
import { SelectObjectsCommand, ClearSelectionCommand, DeselectObjectsCommand } from './commands/SelectionCommands';
import { ApplyEraserCommand } from './commands/EraserCommands';
import { MoveCommand } from './commands/MoveCommand';
import { ResizeCommand } from './commands/ResizeCommand';
import { RotateCommand } from './commands/RotateCommand';
import { CreateObjectsCommand, DeleteObjectsCommand } from './commands/ObjectCommands';
import { ObjectTextCommand } from './commands/ObjectTextCommand';

export function initCommands() {
  console.log('Registering commands...');

  // Register each command type
  registerCommand(SelectObjectsCommand);
  registerCommand(DeselectObjectsCommand);
  registerCommand(ClearSelectionCommand);
  registerCommand(PanViewportCommand);
  registerCommand(ZoomViewportCommand);
  registerCommand(AddShapeCommand);
  registerCommand(PencilCommand);
  registerCommand(ApplyEraserCommand);
  registerCommand(MoveCommand);
  registerCommand(ResizeCommand);
  registerCommand(RotateCommand);
  registerCommand(ClearCanvasCommand);
  registerCommand(CreateObjectsCommand);
  registerCommand(DeleteObjectsCommand);
  registerCommand(ObjectTextCommand);

  console.log('Commands registered!');
}