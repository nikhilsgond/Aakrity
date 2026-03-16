import { BaseCommand } from '../history/BaseCommand';

const cloneObject = (obj) => JSON.parse(JSON.stringify(obj));

export class CreateObjectsCommand extends BaseCommand {
  constructor(objects = []) {
    super();
    this.objects = objects.map((obj) => cloneObject(obj));
    this.objectIds = this.objects.map((obj) => obj.id);
    this.operation = 'create';
  }

  execute(state) {
    this.objects.forEach((obj) => {
      if (!obj || !obj.id) return;
      const exists = state.objects.some((o) => o.id === obj.id);
      if (exists) return;
      state.objects.push(cloneObject(obj));
    });
  }

  undo(state) {
    if (!Array.isArray(this.objectIds)) return;
    this.objectIds.forEach((id) => {
      const idx = state.objects.findIndex((o) => o.id === id);
      if (idx !== -1) state.objects.splice(idx, 1);
    });
  }

  serialize() {
    return {
      ...super.serialize(),
      type: 'CreateObjectsCommand',
      objects: this.objects,
      objectIds: this.objectIds,
    };
  }

  static deserialize(data) {
    const command = new CreateObjectsCommand(data.objects || []);
    command.id = data.id;
    command.timestamp = data.timestamp;
    command.userId = data.userId;
    command.objectIds = data.objectIds || command.objects.map((obj) => obj.id);
    return command;
  }
}

export class DeleteObjectsCommand extends BaseCommand {
  constructor(objects = []) {
    super();
    this.objects = objects.map((obj) => cloneObject(obj));
    this.objectIds = this.objects.map((obj) => obj.id);
    this.deleted = [];
    this.operation = 'delete';
  }

  execute(state) {
    this.deleted = [];

    this.objectIds.forEach((id) => {
      const idx = state.objects.findIndex((o) => o.id === id);
      if (idx === -1) return;
      const snapshot = cloneObject(state.objects[idx]);
      this.deleted.push({ obj: snapshot, index: idx });
      state.objects.splice(idx, 1);
    });

    if (Array.isArray(state.selection) && state.selection.length > 0) {
      state.selection = state.selection.filter((id) => !this.objectIds.includes(id));
    }
  }

  undo(state) {
    if (this.deleted && this.deleted.length > 0) {
      const ordered = [...this.deleted].sort((a, b) => a.index - b.index);
      ordered.forEach(({ obj, index }) => {
        obj.creationSource = 'history';
        const safeIndex = Math.min(Math.max(index, 0), state.objects.length);
        state.objects.splice(safeIndex, 0, cloneObject(obj));
      });
      return;
    }

    this.objects.forEach((obj) => {
      if (!obj || !obj.id) return;
      const exists = state.objects.some((o) => o.id === obj.id);
      if (!exists) state.objects.push(cloneObject(obj));
    });
  }

  serialize() {
    return {
      ...super.serialize(),
      type: 'DeleteObjectsCommand',
      objects: this.objects,
      objectIds: this.objectIds,
      deleted: this.deleted,
    };
  }

  static deserialize(data) {
    const command = new DeleteObjectsCommand(data.objects || []);
    command.id = data.id;
    command.timestamp = data.timestamp;
    command.userId = data.userId;
    command.objectIds = data.objectIds || command.objects.map((obj) => obj.id);
    command.deleted = Array.isArray(data.deleted) ? data.deleted : [];
    return command;
  }
}
