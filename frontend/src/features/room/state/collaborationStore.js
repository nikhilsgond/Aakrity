import { create } from 'zustand';
import socketService from '@features/room/services/socketService';
import { useUIStore } from '@app/state/uiStore';

const useCollaborationStore = create((set, get) => ({
  roomId: null,
  users: new Map(),
  cursors: new Map(),
  remoteSelections: new Map(),
  localSelection: [], 
  objectLocks: new Map(),
  titleEditLock: null,
  chatMessages: [],
  unreadCount: 0,
  isConnected: false,
  currentUser: null,
  handleRemoteOperation: null,
  clientId: null,

  // Batch drawing support methods
  decompressPoints: (compressed, isCompressed) => {
    // If not compressed or invalid format, return as-is
    if (!isCompressed || !Array.isArray(compressed) || compressed.length === 0) {
      return compressed;
    }
    
    const points = [];
    let x = 0, y = 0;
    
    for (let i = 0; i < compressed.length; i++) {
      if (i === 0) {
        // First point is absolute
        x = compressed[i][0];
        y = compressed[i][1];
        points.push({ x, y });
      } else {
        // Subsequent points are deltas (relative movements)
        x += compressed[i][0];
        y += compressed[i][1];
        points.push({ x, y });
      }
    }
    
    return points;
  },

  handleDrawingBatch: (operation) => {
    const { handleRemoteOperation, decompressPoints } = get();
    
    // If no handler registered, can't do anything
    if (!handleRemoteOperation) {
      console.warn('No remote operation handler registered');
      return;
    }
    
    // Step 1: Decompress the points
    const points = decompressPoints(
      operation.points, 
      operation.compressed || false
    );
    
    console.log(`Received batch with ${points.length} points`);
    
    // Step 2: Send drawing:start if this is the first batch of a stroke
    if (operation.isStart) {
      handleRemoteOperation({
        type: 'drawing:start',
        point: points[0],
        userId: operation.userId,
        timestamp: operation.timestamp,
      });
    }
    
    // Step 3: Send each point individually to the canvas manager
    points.forEach((point, index) => {
      handleRemoteOperation({
        type: 'drawing:point',
        point: point,
        userId: operation.userId,
        timestamp: operation.timestamp,
        // Include metadata if needed
        batchIndex: index,
        batchTotal: points.length,
      });
    });
    
    // Step 4: Send drawing:end if this is the last batch
    if (operation.isLastBatch) {
      handleRemoteOperation({
        type: 'drawing:end',
        userId: operation.userId,
        timestamp: operation.timestamp,
      });
    }
  },

  initialize: (roomId, userId, username, color, accessToken) => {
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2,11)}`;
    
    socketService.connect(roomId, userId, username, color, accessToken);

    socketService.on('room-joined', (data) => {
      const usersMap = new Map();
      (data.users || []).forEach((user) => {
        usersMap.set(user.id, {
          ...user,
          isCurrentUser: user.id === userId,
        });
      });

      const locksMap = new Map();
      if (data.selections) {
        Object.entries(data.selections).forEach(([userId, objectIds]) => {
          objectIds.forEach(objectId => {
            locksMap.set(objectId, {
              userId,
              username: usersMap.get(userId)?.name || 'Unknown',
              timestamp: Date.now(),
            });
          });
        });
      }

      set({
        roomId: data.roomId,
        users: usersMap,
        objectLocks: locksMap,
        isConnected: true,
        clientId,
        currentUser: {
          id: userId,
          name: username,
          color,
        },
        localSelection: [],
      });

      if (data.title) {
        useUIStore.setState({ boardTitle: data.title });
      }
    });

    socketService.on('room-error', (payload) => {
      useUIStore.getState().pushNotification({
        type: 'error',
        title: 'Room connection failed',
        message: payload?.message || 'Unable to join this room.',
      });
      set({ isConnected: false });
    });

    socketService.on('user-joined', (user) => {
      set((state) => {
        const usersMap = new Map(state.users);
        usersMap.set(user.id, {
          ...user,
          isCurrentUser: user.id === userId,
        });
        return { users: usersMap };
      });
    });

    socketService.on('user-left', (leftUserId) => {
      set((state) => {
        const usersMap = new Map(state.users);
        usersMap.delete(leftUserId);

        const cursors = new Map(state.cursors);
        cursors.delete(leftUserId);

        const remoteSelections = new Map(state.remoteSelections);
        remoteSelections.delete(leftUserId);

        const objectLocks = new Map(state.objectLocks);
        for (const [objectId, lock] of objectLocks.entries()) {
          if (lock.userId === leftUserId) {
            objectLocks.delete(objectId);
          }
        }

        const titleEditLock = (state.titleEditLock && state.titleEditLock.userId === leftUserId)
          ? null
          : state.titleEditLock;

        return {
          users: usersMap,
          cursors,
          remoteSelections,
          objectLocks,
          titleEditLock,
        };
      });
    });

    socketService.on('selection-changed', (data) => {
      if (!data?.userId || data.userId === get().currentUser?.id) return;

      set((state) => {
        const remoteSelections = new Map(state.remoteSelections);
        const previousSelection = remoteSelections.get(data.userId) || [];
        
        if (!data.objectIds || data.objectIds.length === 0) {
          remoteSelections.delete(data.userId);
        } else {
          remoteSelections.set(data.userId, data.objectIds);
        }

        const objectLocks = new Map(state.objectLocks);
        const username = state.users.get(data.userId)?.name || 'Unknown';
        
        // Remove only objects that are no longer selected
        previousSelection.forEach(id => {
          if (!data.objectIds?.includes(id)) {
            objectLocks.delete(id);
          }
        });
        
        // Add new locks for newly selected objects
        if (data.objectIds && data.objectIds.length > 0) {
          data.objectIds.forEach(objectId => {
            const existingLock = objectLocks.get(objectId);
            if (!existingLock) {
              objectLocks.set(objectId, {
                userId: data.userId,
                username,
                timestamp: Date.now(),
              });
            }
          });
        }

        return { remoteSelections, objectLocks };
      });
    });

    socketService.on('cursor-move', (data) => {
      if (!data?.userId || !data.position) return;

      set((state) => {
        const cursors = new Map(state.cursors);
        cursors.set(data.userId, {
          worldX: data.position.worldX,
          worldY: data.position.worldY,
          state: data.position.state || 'idle',
          tool: data.position.tool || 'select',
          viewport: data.position.viewport || null,
        });
        return { cursors };
      });
    });

    socketService.on('chat-message', (message) => {
      const isChatOpen = useUIStore.getState().isChatOpen;
      set((state) => ({
        chatMessages: [...state.chatMessages, message],
        unreadCount: isChatOpen ? 0 : state.unreadCount + 1,
      }));
    });

    // FIXED: canvas-operation handler with batch support
    socketService.on('canvas-operation', (data) => {
      const { handleRemoteOperation, clientId, handleDrawingBatch } = get();
      
      // Ignore our own operations (deduplication)
      if (data.clientId && data.clientId === clientId) {
        return;
      }

      // SPECIAL HANDLING: drawing:batch needs decompression
      if (data.type === 'drawing:batch') {
        handleDrawingBatch(data);
        return;
      }

      // All other operation types pass through directly
      if (handleRemoteOperation) {
        handleRemoteOperation(data);
      }
    });

    socketService.on('connect-error', () => {
      set({ isConnected: false });
    });

    socketService.on('disconnected', () => {
      set({ isConnected: false });
    });

    socketService.on('reconnected', () => {
      const store = get();
      
      if (!store.currentUser) return;
      
      const myLocks = store.getMyLockedObjects();
      
      set((prev) => {
        const existingLocks = new Map(prev.objectLocks);
        
        // Restore my locks
        myLocks.forEach(id => {
          existingLocks.set(id, {
            userId: store.currentUser.id,
            username: store.currentUser.name,
            timestamp: Date.now(),
          });
        });

        return {
          isConnected: true,
          remoteSelections: new Map(),
          objectLocks: existingLocks, 
        };
      });
      
      // Server will resync remote selections via selection-changed
    });

    // Backward compatibility
    socketService.on('object:locked', (data) => {
      if (!data?.objectIds) return;
      set((state) => {
        const objectLocks = new Map(state.objectLocks);
        data.objectIds.forEach((id) => {
          const existingLock = objectLocks.get(id);
          if (!existingLock) {
            objectLocks.set(id, {
              userId: data.userId,
              username: data.username,
              timestamp: Date.now(),
            });
          }
        });
        return { objectLocks };
      });
    });

    socketService.on('object:unlocked', (data) => {
      if (!data?.objectIds) return;
      set((state) => {
        const objectLocks = new Map(state.objectLocks);
        data.objectIds.forEach((id) => {
          const lock = objectLocks.get(id);
          if (lock && lock.userId === data.userId) {
            objectLocks.delete(id);
          }
        });
        return { objectLocks };
      });
    });
  },

  updateSelection: (objectIds) => {
    const { currentUser, roomId, localSelection } = get();
    if (!currentUser || !roomId) return;

    const prevSet = new Set(localSelection || []);
    const newSet = new Set(objectIds || []);
    
    // Check if selection actually changed
    if (prevSet.size === newSet.size && 
        [...prevSet].every(id => newSet.has(id))) {
      return; 
    }

    // Update local state with optimized lock cleanup
    set((state) => {
      const remoteSelections = new Map(state.remoteSelections);
      if (!objectIds || objectIds.length === 0) {
        remoteSelections.delete(currentUser.id);
      } else {
        remoteSelections.set(currentUser.id, objectIds);
      }

      const objectLocks = new Map(state.objectLocks);
      
      // Only remove locks for objects that are no longer selected
      for (const [objectId, lock] of objectLocks.entries()) {
        if (lock.userId === currentUser.id && !objectIds?.includes(objectId)) {
          objectLocks.delete(objectId);
        }
      }
      
      // Add new locks for newly selected objects
      if (objectIds && objectIds.length > 0) {
        objectIds.forEach(objectId => {
          const existingLock = objectLocks.get(objectId);
          if (!existingLock) {
            objectLocks.set(objectId, {
              userId: currentUser.id,
              username: currentUser.name,
              timestamp: Date.now(),
            });
          }
        });
      }

      return { 
        remoteSelections, 
        objectLocks, 
        localSelection: objectIds || [] 
      };
    });

    // Broadcast to other users (only when actually changed)
    socketService.emit('selection-changed', {
      roomId,
      userId: currentUser.id,
      objectIds: objectIds || [],
    });
  },

  hydrateRoom: ({ roomId, title, chatMessages, users }) => {
    const usersMap = new Map();
    (users || []).forEach((user) => {
      usersMap.set(user.id, {
        ...user,
        isCurrentUser: user.id === get().currentUser?.id,
      });
    });

    if (title) {
      useUIStore.setState({ boardTitle: title });
    }

    set({
      roomId,
      users: usersMap.size > 0 ? usersMap : get().users,
      chatMessages: Array.isArray(chatMessages) ? chatMessages : [],
      unreadCount: 0,
    });
  },

  setRemoteSelection: (userId, objectIds) => {
    set((state) => {
      const remoteSelections = new Map(state.remoteSelections);
      if (!objectIds || objectIds.length === 0) {
        remoteSelections.delete(userId);
      } else {
        remoteSelections.set(userId, objectIds);
      }
      return { remoteSelections };
    });
  },

  getLockedObjectIds: () => {
    const { objectLocks } = get();
    return new Set(objectLocks.keys());
  },

  isLockedByOther: (objectId) => {
    const { objectLocks, currentUser } = get();
    const lock = objectLocks.get(objectId);
    return !!lock && lock.userId !== currentUser?.id;
  },

  getLockInfo: (objectId) => {
    const { objectLocks } = get();
    return objectLocks.get(objectId) || null;
  },

  getMyLockedObjects: () => {
    const { objectLocks, currentUser } = get();
    const myLocks = [];
    for (const [objectId, lock] of objectLocks.entries()) {
      if (lock.userId === currentUser?.id) {
        myLocks.push(objectId);
      }
    }
    return myLocks;
  },

  lockObjects: (objectIds) => {
    const { currentUser, roomId } = get();
    if (!currentUser || !roomId || !objectIds?.length) return;
    
    set((state) => {
      const objectLocks = new Map(state.objectLocks);
      objectIds.forEach((id) => {
        const existingLock = objectLocks.get(id);
        if (!existingLock) {
          objectLocks.set(id, {
            userId: currentUser.id,
            username: currentUser.name,
            timestamp: Date.now(),
          });
        }
      });
      return { objectLocks };
    });

    socketService.emit('object:lock', {
      roomId,
      userId: currentUser.id,
      username: currentUser.name,
      objectIds,
    });
  },

  unlockObjects: (objectIds) => {
    const { currentUser, roomId } = get();
    if (!currentUser || !roomId || !objectIds?.length) return;

    set((state) => {
      const objectLocks = new Map(state.objectLocks);
      objectIds.forEach((id) => {
        const lock = objectLocks.get(id);
        if (lock && lock.userId === currentUser.id) {
          objectLocks.delete(id);
        }
      });
      return { objectLocks };
    });

    socketService.emit('object:unlock', {
      roomId,
      userId: currentUser.id,
      objectIds,
    });
  },

  releaseAllMyLocks: () => {
    const { currentUser, roomId, objectLocks } = get();
    if (!currentUser || !roomId) return;

    const myLockedObjects = [];
    for (const [objectId, lock] of objectLocks.entries()) {
      if (lock.userId === currentUser.id) {
        myLockedObjects.push(objectId);
      }
    }

    if (myLockedObjects.length > 0) {
      get().unlockObjects(myLockedObjects);
    }
  },

  sendCanvasOperation: (operation) => {
    const { clientId } = get();
    socketService.emitCanvasOperation({
      ...operation,
      clientId,
    });
  },

  updateCursor: (position) => {
    socketService.emitCursorPosition({
      worldX: position.worldX,
      worldY: position.worldY,
      state: position.state,
      tool: position.tool,
      viewport: position.viewport,
    });
  },

  sendChatMessage: (messageData) => {
    return socketService.sendMessage(messageData);
  },

  clearUnreadCount: () => {
    set({ unreadCount: 0 });
  },

  isOwnOperation: (data) => {
    const { clientId } = get();
    return data.clientId && data.clientId === clientId;
  },

  disconnect: () => {
    get().releaseAllMyLocks();
    
    socketService.disconnect();
    set({
      users: new Map(),
      cursors: new Map(),
      remoteSelections: new Map(),
      localSelection: [],
      objectLocks: new Map(),
      titleEditLock: null,
      chatMessages: [],
      unreadCount: 0,
      isConnected: false,
      currentUser: null,
      roomId: null,
      handleRemoteOperation: null,
      clientId: null,
    });
  },
}));

export default useCollaborationStore;