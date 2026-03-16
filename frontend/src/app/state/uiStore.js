// src/store/uiStore.js - UPDATED WITH CONSTANTS
import { create } from 'zustand';
import { GRID_MODES } from '@shared/constants';

export const useUIStore = create((set, get) => ({
  // Panel states
  isPropertiesPanelOpen: false,
  isChatOpen: false,
  isMinimapOpen: false,

  // Modal states
  isShortcutsModalOpen: false,
  isExportModalOpen: false,
  isShareModalOpen: false,

  // Theme
  theme: localStorage.getItem('theme') || 'light',

  // Current board info
  boardTitle: 'Untitled Board',

  // Grid mode - use constant
  gridMode: GRID_MODES.LINES,

  // Notification center
  notifications: [],

  // Actions
  // Panels
  togglePropertiesPanel: () => set((state) => ({
    isPropertiesPanelOpen: !state.isPropertiesPanelOpen
  })),
  setPropertiesPanelOpen: (open) => set({ isPropertiesPanelOpen: open }),

  // Chat
  toggleChat: () => set((state) => ({
    isChatOpen: !state.isChatOpen
  })),
  setChatOpen: (open) => set({ isChatOpen: open }),

  // Minimap
  toggleMinimap: () => set((state) => ({
    isMinimapOpen: !state.isMinimapOpen
  })),

  // Grid mode - cycle through GRID_MODES
  toggleGridMode: () => {
    const { gridMode } = get();
    const modes = Object.values(GRID_MODES);
    const currentIndex = modes.indexOf(gridMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    set({ gridMode: nextMode });
  },
  setGridMode: (mode) => set({ gridMode: mode }),

  // Modals
  openShortcutsModal: () => set({ isShortcutsModalOpen: true }),
  closeShortcutsModal: () => set({ isShortcutsModalOpen: false }),

  openExportModal: () => set({ isExportModalOpen: true }),
  closeExportModal: () => set({ isExportModalOpen: false }),

  openShareModal: () => set({ isShareModalOpen: true }),
  closeShareModal: () => set({ isShareModalOpen: false }),

  // Theme
  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem('theme', theme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  },

  setBoardTitle: (title) => set({ boardTitle: title }),

  // Notifications
  pushNotification: (payload = {}) => {
    const id = `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const notification = {
      id,
      type: payload.type || 'info',
      title: payload.title || '',
      message: payload.message || '',
      duration: payload.duration ?? 2800,
      closing: false,
      createdAt: Date.now(),
    };

    set((state) => ({ notifications: [...state.notifications, notification] }));

    if (notification.duration > 0) {
      setTimeout(() => {
        get().dismissNotification(id);
      }, notification.duration);
    }

    return id;
  },

  dismissNotification: (id) => {
    if (!id) return;

    let exists = false;
    set((state) => {
      const notifications = state.notifications.map((n) => {
        if (n.id !== id) return n;
        exists = true;
        if (n.closing) return n;
        return { ...n, closing: true };
      });
      return { notifications };
    });

    if (!exists) return;
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 220);
  },

  clearNotifications: () => set({ notifications: [] }),

  // Initialize theme
  initTheme: () => {
    const { theme } = get();
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }
}));
