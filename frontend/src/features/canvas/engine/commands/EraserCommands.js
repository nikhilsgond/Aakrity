import { BaseCommand } from "../history/BaseCommand";

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }
  if (value && typeof value === "object") {
    const cloned = {};
    Object.keys(value).forEach((key) => {
      if (key.startsWith("_")) return;
      if (key === "imageElement") return;
      const next = value[key];
      if (typeof next === "function") return;
      cloned[key] = cloneValue(next);
    });
    return cloned;
  }
  return value;
}

function cloneCanvasObject(obj) {
  return cloneValue(obj);
}

function upsertById(objects, object) {
  const idx = objects.findIndex((entry) => entry.id === object.id);
  if (idx >= 0) {
    objects[idx] = cloneCanvasObject(object);
  } else {
    objects.push(cloneCanvasObject(object));
  }
}

export class ApplyEraserCommand extends BaseCommand {
  constructor({ beforeObjects = [], afterObjects = [], addedObjects = [], meta = {} } = {}) {
    super();
    this.beforeObjects = beforeObjects.map((obj) => cloneCanvasObject(obj));
    this.afterObjects = afterObjects.map((obj) => cloneCanvasObject(obj));
    this.addedObjects = addedObjects.map((obj) => cloneCanvasObject(obj));
    this.meta = { ...meta };

    this.objectId = this.beforeObjects[0]?.id || this.afterObjects[0]?.id || null;
  }

  execute(state) {
    if (!state || !Array.isArray(state.objects)) return false;

    const beforeIds = new Set(this.beforeObjects.map((obj) => obj.id));
    const afterById = new Map(this.afterObjects.map((obj) => [obj.id, cloneCanvasObject(obj)]));
    const addedById = new Map(this.addedObjects.map((obj) => [obj.id, cloneCanvasObject(obj)]));

    for (let i = state.objects.length - 1; i >= 0; i -= 1) {
      const current = state.objects[i];
      if (!current?.id) continue;

      if (addedById.has(current.id)) {
        state.objects.splice(i, 1);
        continue;
      }

      if (!beforeIds.has(current.id)) continue;

      const replacement = afterById.get(current.id);
      if (replacement) {
        state.objects[i] = cloneCanvasObject(replacement);
        afterById.delete(current.id);
      } else {
        state.objects.splice(i, 1);
      }
    }

    afterById.forEach((obj) => upsertById(state.objects, obj));
    addedById.forEach((obj) => upsertById(state.objects, obj));
    return true;
  }

  undo(state) {
    if (!state || !Array.isArray(state.objects)) return false;

    const addedIds = new Set(this.addedObjects.map((obj) => obj.id));
    const beforeById = new Map(this.beforeObjects.map((obj) => [obj.id, cloneCanvasObject(obj)]));
    const beforeIds = new Set(beforeById.keys());

    for (let i = state.objects.length - 1; i >= 0; i -= 1) {
      const current = state.objects[i];
      if (!current?.id) continue;

      if (addedIds.has(current.id)) {
        state.objects.splice(i, 1);
        continue;
      }

      if (!beforeIds.has(current.id)) continue;

      const replacement = beforeById.get(current.id);
      if (replacement) {
        state.objects[i] = cloneCanvasObject(replacement);
        beforeById.delete(current.id);
      }
    }

    beforeById.forEach((obj) => upsertById(state.objects, obj));
    return true;
  }

  serialize() {
    return {
      ...super.serialize(),
      beforeObjects: this.beforeObjects,
      afterObjects: this.afterObjects,
      addedObjects: this.addedObjects,
      meta: this.meta,
    };
  }

  static deserialize(data) {
    const command = new ApplyEraserCommand({
      beforeObjects: data.beforeObjects || [],
      afterObjects: data.afterObjects || [],
      addedObjects: data.addedObjects || [],
      meta: data.meta || {},
    });
    command.id = data.id;
    command.timestamp = data.timestamp;
    command.userId = data.userId;
    return command;
  }
}

export const EraserCommandFactory = {
  createPatch(payload) {
    return new ApplyEraserCommand(payload);
  },
};

export default ApplyEraserCommand;
