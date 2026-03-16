/**
 * Phase 4 — Collaboration Tests
 *
 * Object create sync
 * Move sync
 * Resize sync
 * Lock while editing
 * Lock release on disconnect
 * Conflict prevention
 *
 * NOTE: These tests simulate collaboration logic at the data/store level
 * without a real socket connection. We test the locking logic, command
 * execution isolation, and state consistency.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createState, makeRect, makeCircle } from './helpers.js';

import { HistoryManager } from '../src/features/canvas/engine/history/HistoryManager.js';
import { AddShapeCommand } from '../src/features/canvas/engine/commands/ShapeCommands.js';
import { MoveCommand } from '../src/features/canvas/engine/commands/MoveCommand.js';
import { ResizeCommand } from '../src/features/canvas/engine/commands/ResizeCommand.js';
import SelectionManager from '../src/features/canvas/engine/SelectionManager.js';

/* ================================================================
   Simulated Lock Manager (mirrors server logic)
   ================================================================ */
class MockLockManager {
  constructor() {
    this.locks = new Map(); // objectId → { userId, username, timestamp }
  }

  lock(objectIds, userId, username) {
    const lockedIds = [];
    (objectIds || []).forEach(objectId => {
      const existing = this.locks.get(objectId);
      if (!existing || existing.userId === userId) {
        this.locks.set(objectId, { userId, username, timestamp: Date.now() });
        lockedIds.push(objectId);
      }
    });
    return lockedIds;
  }

  unlock(objectIds, userId) {
    const unlockedIds = [];
    (objectIds || []).forEach(objectId => {
      const existing = this.locks.get(objectId);
      if (existing && existing.userId === userId) {
        this.locks.delete(objectId);
        unlockedIds.push(objectId);
      }
    });
    return unlockedIds;
  }

  unlockAllForUser(userId) {
    const unlockedIds = [];
    for (const [objectId, lock] of this.locks.entries()) {
      if (lock.userId === userId) {
        this.locks.delete(objectId);
        unlockedIds.push(objectId);
      }
    }
    return unlockedIds;
  }

  isLockedByOther(objectId, currentUserId) {
    const lock = this.locks.get(objectId);
    if (!lock) return false;
    return lock.userId !== currentUserId;
  }

  getLockInfo(objectId) {
    return this.locks.get(objectId) || null;
  }

  getLockedObjectIds() {
    return new Set(this.locks.keys());
  }
}

/* ================================================================
   Object Create Sync
   ================================================================ */
describe('Phase 4 — Object Create Sync', () => {
  let stateA, stateB, hmA, hmB;

  beforeEach(() => {
    stateA = createState();
    stateB = createState();
    hmA = new HistoryManager();
    hmB = new HistoryManager();
  });

  it('object created by user A can be applied to user B state', () => {
    const rect = makeRect({ id: 'shared_r1' });
    const cmd = new AddShapeCommand(rect);

    // User A creates
    hmA.execute(cmd, stateA);
    expect(stateA.objects).toHaveLength(1);

    // Simulate sync: apply same command to B
    const cmdB = new AddShapeCommand(rect);
    cmdB.execute(stateB);
    expect(stateB.objects).toHaveLength(1);
    expect(stateB.objects[0].id).toBe('shared_r1');
  });

  it('duplicate create is idempotent', () => {
    const rect = makeRect({ id: 'shared_r1' });
    const cmd1 = new AddShapeCommand(rect);
    const cmd2 = new AddShapeCommand(rect);
    cmd1.execute(stateA);
    cmd2.execute(stateA);
    expect(stateA.objects).toHaveLength(1);
  });

  it('both states converge with same operations', () => {
    const r1 = makeRect({ id: 'r1' });
    const c1 = makeCircle({ id: 'c1' });

    [stateA, stateB].forEach(s => {
      new AddShapeCommand(r1).execute(s);
      new AddShapeCommand(c1).execute(s);
    });

    expect(stateA.objects).toHaveLength(2);
    expect(stateB.objects).toHaveLength(2);
    expect(stateA.objects.map(o => o.id)).toEqual(stateB.objects.map(o => o.id));
  });
});

/* ================================================================
   Move Sync
   ================================================================ */
describe('Phase 4 — Move Sync', () => {
  let stateA, stateB;

  beforeEach(() => {
    stateA = createState();
    stateB = createState();
    const rect = makeRect({ id: 'r1', x: 100, y: 100 });
    stateA.objects.push({ ...rect });
    stateB.objects.push({ ...rect });
  });

  it('move on user A synced to user B produces same position', () => {
    const cmd = new MoveCommand(['r1'], { x: 50, y: 25 });
    cmd.execute(stateA);

    // Simulate sync
    const cmdB = new MoveCommand(['r1'], { x: 50, y: 25 });
    cmdB.execute(stateB);

    expect(stateA.objects[0].x).toBe(stateB.objects[0].x);
    expect(stateA.objects[0].y).toBe(stateB.objects[0].y);
  });
});

/* ================================================================
   Resize Sync
   ================================================================ */
describe('Phase 4 — Resize Sync', () => {
  let stateA, stateB;

  beforeEach(() => {
    stateA = createState();
    stateB = createState();
    const rect = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100 });
    stateA.objects.push({ ...rect });
    stateB.objects.push({ ...rect });
  });

  it('resize on user A synced to user B produces same dimensions', () => {
    const resizeData = { scaleX: 1.5, scaleY: 1.5, origin: { x: 0, y: 0 } };
    new ResizeCommand(['r1'], resizeData).execute(stateA);
    new ResizeCommand(['r1'], resizeData).execute(stateB);

    expect(stateA.objects[0].width).toBe(stateB.objects[0].width);
    expect(stateA.objects[0].height).toBe(stateB.objects[0].height);
  });
});

/* ================================================================
   Locking
   ================================================================ */
describe('Phase 4 — Object Locking', () => {
  let lockManager;

  beforeEach(() => {
    lockManager = new MockLockManager();
  });

  it('lock assigns object to user', () => {
    const locked = lockManager.lock(['r1'], 'userA', 'Alice');
    expect(locked).toEqual(['r1']);
    expect(lockManager.getLockInfo('r1').userId).toBe('userA');
  });

  it('same user can re-lock their own object', () => {
    lockManager.lock(['r1'], 'userA', 'Alice');
    const locked = lockManager.lock(['r1'], 'userA', 'Alice');
    expect(locked).toEqual(['r1']);
  });

  it('different user cannot lock already-locked object', () => {
    lockManager.lock(['r1'], 'userA', 'Alice');
    const locked = lockManager.lock(['r1'], 'userB', 'Bob');
    expect(locked).toEqual([]);
    expect(lockManager.getLockInfo('r1').userId).toBe('userA');
  });

  it('unlock releases the lock', () => {
    lockManager.lock(['r1'], 'userA', 'Alice');
    const unlocked = lockManager.unlock(['r1'], 'userA');
    expect(unlocked).toEqual(['r1']);
    expect(lockManager.getLockInfo('r1')).toBeNull();
  });

  it('wrong user cannot unlock', () => {
    lockManager.lock(['r1'], 'userA', 'Alice');
    const unlocked = lockManager.unlock(['r1'], 'userB');
    expect(unlocked).toEqual([]);
    expect(lockManager.getLockInfo('r1')).not.toBeNull();
  });

  it('isLockedByOther works correctly', () => {
    lockManager.lock(['r1'], 'userA', 'Alice');
    expect(lockManager.isLockedByOther('r1', 'userB')).toBe(true);
    expect(lockManager.isLockedByOther('r1', 'userA')).toBe(false);
    expect(lockManager.isLockedByOther('r2', 'userB')).toBe(false);
  });

  it('lock multiple objects at once', () => {
    const locked = lockManager.lock(['r1', 'r2', 'r3'], 'userA', 'Alice');
    expect(locked).toEqual(['r1', 'r2', 'r3']);
  });

  it('partial lock when some objects already locked by others', () => {
    lockManager.lock(['r1'], 'userB', 'Bob');
    const locked = lockManager.lock(['r1', 'r2'], 'userA', 'Alice');
    expect(locked).toEqual(['r2']); // r1 was already locked by Bob
  });

  it('getLockedObjectIds returns all locked ids', () => {
    lockManager.lock(['r1', 'r2'], 'userA', 'Alice');
    lockManager.lock(['r3'], 'userB', 'Bob');
    const ids = lockManager.getLockedObjectIds();
    expect(ids.has('r1')).toBe(true);
    expect(ids.has('r2')).toBe(true);
    expect(ids.has('r3')).toBe(true);
    expect(ids.size).toBe(3);
  });
});

/* ================================================================
   Lock Release on Disconnect
   ================================================================ */
describe('Phase 4 — Lock Release on Disconnect', () => {
  let lockManager;

  beforeEach(() => {
    lockManager = new MockLockManager();
  });

  it('disconnecting user releases all their locks', () => {
    lockManager.lock(['r1', 'r2'], 'userA', 'Alice');
    lockManager.lock(['r3'], 'userB', 'Bob');

    // Simulate userA disconnect
    const released = lockManager.unlockAllForUser('userA');
    expect(released).toEqual(['r1', 'r2']);

    // userB locks should remain
    expect(lockManager.getLockInfo('r3').userId).toBe('userB');
    expect(lockManager.getLockInfo('r1')).toBeNull();
  });

  it('disconnecting user with no locks releases nothing', () => {
    lockManager.lock(['r1'], 'userA', 'Alice');
    const released = lockManager.unlockAllForUser('userC');
    expect(released).toEqual([]);
    expect(lockManager.getLockInfo('r1')).not.toBeNull();
  });
});

/* ================================================================
   Conflict Prevention
   ================================================================ */
describe('Phase 4 — Conflict Prevention', () => {
  let lockManager, stateA, stateB;

  beforeEach(() => {
    lockManager = new MockLockManager();
    stateA = createState();
    stateB = createState();
    const rect = makeRect({ id: 'r1', x: 100, y: 100 });
    stateA.objects.push({ ...rect });
    stateB.objects.push({ ...rect });
  });

  it('user B move is blocked when object is locked by user A', () => {
    lockManager.lock(['r1'], 'userA', 'Alice');

    // User B tries to move r1 — check lock first
    const isBlocked = lockManager.isLockedByOther('r1', 'userB');
    expect(isBlocked).toBe(true);

    // Move should NOT be applied
    if (!isBlocked) {
      new MoveCommand(['r1'], { x: 50, y: 50 }).execute(stateB);
    }

    // Position should remain unchanged
    expect(stateB.objects[0].x).toBe(100);
    expect(stateB.objects[0].y).toBe(100);
  });

  it('user A can move their own locked object', () => {
    lockManager.lock(['r1'], 'userA', 'Alice');
    const isBlocked = lockManager.isLockedByOther('r1', 'userA');
    expect(isBlocked).toBe(false);

    new MoveCommand(['r1'], { x: 50, y: 50 }).execute(stateA);
    expect(stateA.objects[0].x).toBe(150);
  });

  it('after unlock, user B can move the object', () => {
    lockManager.lock(['r1'], 'userA', 'Alice');
    lockManager.unlock(['r1'], 'userA');

    const isBlocked = lockManager.isLockedByOther('r1', 'userB');
    expect(isBlocked).toBe(false);

    new MoveCommand(['r1'], { x: 25, y: 25 }).execute(stateB);
    expect(stateB.objects[0].x).toBe(125);
  });

  it('concurrent creates with different IDs do not conflict', () => {
    const cmdA = new AddShapeCommand(makeRect({ id: 'rA1' }));
    const cmdB = new AddShapeCommand(makeCircle({ id: 'cB1' }));

    cmdA.execute(stateA);
    cmdB.execute(stateA);
    expect(stateA.objects).toHaveLength(3); // r1 + rA1 + cB1
  });
});

/* ================================================================
   Undo After Remote Operation
   ================================================================ */
describe('Phase 4 — Undo After Remote Operation', () => {
  it('local undo does not affect remotely-applied commands', () => {
    const state = createState();
    const hm = new HistoryManager();

    // Local command
    const localCmd = new AddShapeCommand(makeRect({ id: 'local_r' }));
    hm.execute(localCmd, state);

    // Remote command (applied directly, not through history)
    const remoteCmd = new AddShapeCommand(makeCircle({ id: 'remote_c' }));
    remoteCmd.execute(state);

    expect(state.objects).toHaveLength(2);

    // Undo should only undo the local command
    hm.undo(state);
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].id).toBe('remote_c');
  });
});
