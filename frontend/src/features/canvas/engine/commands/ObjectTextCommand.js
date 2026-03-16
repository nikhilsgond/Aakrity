import { BaseCommand } from '../history/BaseCommand';

const cloneRanges = (ranges) => (Array.isArray(ranges) ? ranges.map((r) => ({ ...r })) : []);

export class ObjectTextCommand extends BaseCommand {
  constructor({ objectId, fieldKey = 'text', previousText, nextText, previousFormattedRanges, nextFormattedRanges } = {}) {
    super();
    this.objectId = objectId;
    this.fieldKey = fieldKey;
    this.previousText = previousText;
    this.nextText = nextText;
    this.previousFormattedRanges = cloneRanges(previousFormattedRanges);
    this.nextFormattedRanges = cloneRanges(nextFormattedRanges);
    this.operation = 'text_update';
  }

  execute(state) {
    const obj = state.objects.find((o) => o.id === this.objectId);
    if (!obj) return false;

    if (this.previousText === undefined) {
      this.previousText = obj[this.fieldKey] ?? '';
    }
    if (this.previousFormattedRanges.length === 0 && Array.isArray(obj.formattedRanges)) {
      this.previousFormattedRanges = cloneRanges(obj.formattedRanges);
    }

    obj[this.fieldKey] = this.nextText ?? '';
    if (this.fieldKey === 'text') {
      obj.formattedRanges = cloneRanges(this.nextFormattedRanges);
    }
    obj.updatedAt = Date.now();
    return true;
  }

  undo(state) {
    const obj = state.objects.find((o) => o.id === this.objectId);
    if (!obj) return false;
    obj[this.fieldKey] = this.previousText ?? '';
    if (this.fieldKey === 'text') {
      obj.formattedRanges = cloneRanges(this.previousFormattedRanges);
    }
    obj.updatedAt = Date.now();
    return true;
  }

  serialize() {
    return {
      ...super.serialize(),
      type: 'ObjectTextCommand',
      objectId: this.objectId,
      fieldKey: this.fieldKey,
      previousText: this.previousText,
      nextText: this.nextText,
      previousFormattedRanges: this.previousFormattedRanges,
      nextFormattedRanges: this.nextFormattedRanges,
    };
  }

  static deserialize(data) {
    const cmd = new ObjectTextCommand({
      objectId: data.objectId,
      fieldKey: data.fieldKey || 'text',
      previousText: data.previousText,
      nextText: data.nextText,
      previousFormattedRanges: data.previousFormattedRanges || [],
      nextFormattedRanges: data.nextFormattedRanges || [],
    });
    cmd.id = data.id;
    cmd.timestamp = data.timestamp;
    cmd.userId = data.userId;
    cmd.operation = data.operation || 'text_update';
    return cmd;
  }
}
