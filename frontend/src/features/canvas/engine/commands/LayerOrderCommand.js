import { BaseCommand } from '../history/BaseCommand';

export class LayerOrderCommand extends BaseCommand {
  constructor(objectIds, direction = 'front') {
    super();
    this.objectIds = Array.isArray(objectIds) ? [...objectIds] : [];
    this.direction = direction === 'back' ? 'back' : 'front';
    this.previousOrderIds = null;
    this.operation = 'layer_order';
  }

  execute(state) {
    if (!state || !Array.isArray(state.objects) || this.objectIds.length === 0) {
      return false;
    }

    if (!this.previousOrderIds) {
      this.previousOrderIds = state.objects.map((obj) => obj.id);
    }

    const selectedIds = new Set(this.objectIds);
    const selected = state.objects.filter((obj) => selectedIds.has(obj.id));
    if (selected.length === 0) return false;

    const rest = state.objects.filter((obj) => !selectedIds.has(obj.id));
    const nextOrder = this.direction === 'front'
      ? [...rest, ...selected]
      : [...selected, ...rest];

    const changed = nextOrder.some((obj, index) => state.objects[index]?.id !== obj.id);
    if (!changed) return false;

    state.objects = nextOrder;
    return true;
  }

  undo(state) {
    if (!state || !Array.isArray(state.objects) || !Array.isArray(this.previousOrderIds)) {
      return false;
    }

    const currentById = new Map(state.objects.map((obj) => [obj.id, obj]));
    const restored = [];

    this.previousOrderIds.forEach((id) => {
      const obj = currentById.get(id);
      if (!obj) return;
      restored.push(obj);
      currentById.delete(id);
    });

    currentById.forEach((obj) => restored.push(obj));
    state.objects = restored;
    return true;
  }

  serialize() {
    return {
      ...super.serialize(),
      type: 'LayerOrderCommand',
      objectIds: this.objectIds,
      direction: this.direction,
      previousOrderIds: this.previousOrderIds,
    };
  }

  static deserialize(data) {
    const cmd = new LayerOrderCommand(data.objectIds || [], data.direction || 'front');
    cmd.id = data.id;
    cmd.timestamp = data.timestamp;
    cmd.userId = data.userId;
    cmd.previousOrderIds = Array.isArray(data.previousOrderIds) ? [...data.previousOrderIds] : null;
    return cmd;
  }
}
