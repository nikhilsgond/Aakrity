// src/features/room/services/socketService.js
import { io } from 'socket.io-client';

class SocketService {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.userId = null;
        this.username = null;
        this.eventHandlers = new Map();
    }

    connect(roomId, userId, username, color, accessToken) {
        if (this.socket) {
            this.disconnect();
        }

        this.roomId = roomId;
        this.userId = userId;
        this.username = username;
        this.userColor = color;

        const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

        this.socket = io(socketUrl, {
            auth: {
                token: accessToken,
            },
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 30,
            reconnectionDelay: 1500,
            reconnectionDelayMax: 5000,
            maxHttpBufferSize: 10 * 1024 * 1024, 
        });

        this.setupBaseListeners();
        return this.socket;
    }

    setupBaseListeners() {
        this.socket.on('connect', () => {
            this.emitEvent('connected');
            
            // Always rejoin room on connect (including reconnect)
            if (this.roomId) {
                this.socket.emit('join-room', {
                    roomId: this.roomId,
                });
            }
        });

        this.socket.on('connect_error', (error) => {
            this.emitEvent('connect-error', error);
        });

        this.socket.on('disconnect', (reason) => {
            this.emitEvent('disconnected', { reason });
        });

        // The reconnect event is removed to avoid double joins

        this.socket.on('room-joined', (data) => {
            this.emitEvent('room-joined', data);
        });

        this.socket.on('room:error', (data) => {
            this.emitEvent('room-error', data);
        });

        this.socket.on('user-joined', (user) => {
            this.emitEvent('user-joined', user);
        });

        this.socket.on('user-left', (userId) => {
            this.emitEvent('user-left', userId);
        });

        this.socket.on('canvas-operation', (data) => {
            this.emitEvent('canvas-operation', data);
        });

        this.socket.on('cursor-move', (data) => {
            this.emitEvent('cursor-move', data);
        });

        this.socket.on('chat-message', (message) => {
            this.emitEvent('chat-message', message);
        });

        this.socket.on('chat:error', (payload) => {
            this.emitEvent('chat-error', payload);
        });

        this.socket.on('room:deleted', (payload) => {
            this.emitEvent('room-deleted', payload);
        });

        // Selection and locking events
        this.socket.on('selection-changed', (data) => {
            this.emitEvent('selection-changed', data);
        });

        this.socket.on('object:locked', (data) => {
            this.emitEvent('object:locked', data);
        });

        this.socket.on('object:unlocked', (data) => {
            this.emitEvent('object:unlocked', data);
        });
    }

    // Canvas operation with proper payload structure
    emitCanvasOperation(operation) {
        if (!this.socket?.connected || typeof operation !== 'object') {
            return false;
        }

        this.socket.emit('canvas-operation', {
            roomId: this.roomId,
            userId: this.userId,
            ...operation // Spread operation directly at top level
        });
        
        return true;
    }

    // Cursor position updates
    emitCursorPosition(position) {
        if (!this.socket?.connected) return false;

        this.socket.emit('cursor-move', {
            roomId: this.roomId,
            userId: this.userId,
            position: {
                worldX: position.worldX,
                worldY: position.worldY,
                state: position.state,
                tool: position.tool,
                viewport: position.viewport,
            },
        });
        
        return true;
    }

    // Chat messages
    sendMessage(messageData) {
        if (!this.socket?.connected) {
            return false;
        }

        this.socket.emit('chat-message', {
            roomId: this.roomId,
            userId: this.userId,
            username: this.username,
            ...messageData,
        });

        return true;
    }

    // Generic emit for all other events
    emit(event, data) {
        if (!this.socket || !this.socket.connected) {
            console.warn(`[SocketService] Attempted to emit ${event} but socket is not connected`);
            return false;
        }
        
        this.socket.emit(event, data);
        return true;
    }

    // Event subscription
    on(event, callback) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(callback);
    }

    // Event unsubscription
    off(event, callback) {
        if (callback && this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).delete(callback);
        }
    }

    // Internal event dispatcher
    emitEvent(event, data) {
        const callbacks = this.eventHandlers.get(event);
        if (!callbacks) {
            return;
        }

        callbacks.forEach((callback) => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[SocketService] Error in event handler for ${event}:`, error);
            }
        });
    }

    // Clean disconnect
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.eventHandlers.clear();
    }

    // Connection status
    isConnected() {
        return this.socket?.connected || false;
    }

    // Debug info
    getConnectionInfo() {
        return {
            connected: this.isConnected(),
            roomId: this.roomId,
            userId: this.userId,
            username: this.username,
            socketId: this.socket?.id,
        };
    }
}

export default new SocketService();