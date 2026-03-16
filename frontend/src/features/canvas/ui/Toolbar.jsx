// src/components/canvas/Toolbar.jsx
import { useUIStore } from "@app/state/uiStore";
import { TOOL_TYPES, TOOL_NAMES, KEYBOARD_SHORTCUTS, GRID_MODES } from "@shared/constants";
import {
  MousePointer2, Pencil, Square, Type,
  ImagePlus, Eraser, Smile, StickyNote, Grid3x3, Moon, Sun, Map
} from 'lucide-react';

// Toolbar is now a PURE PRESENTATIONAL component
export default function Toolbar({
  activeTool,
  setActiveTool,
  toolManager,
  canvasManager
}) {
  const {
    toggleGridMode,
    gridMode,
    theme,
    setTheme,
    isMinimapOpen,
    toggleMinimap,
  } = useUIStore();

  // Get available tools from ToolManager instance
  const availableTools = toolManager ? toolManager.getRegisteredToolTypes() : [
    TOOL_TYPES.PENCIL,
    TOOL_TYPES.SHAPE,
    TOOL_TYPES.SELECT,
  ];


  // Tool groups
  const toolGroups = [
    {
      name: 'Selection',
      tools: [
        {
          type: TOOL_TYPES.SELECT,
          icon: MousePointer2,
          label: TOOL_NAMES[TOOL_TYPES.SELECT],
          shortcut: KEYBOARD_SHORTCUTS.SELECT,
          available: availableTools.includes(TOOL_TYPES.SELECT)
        }
      ]
    },
    {
      name: 'Drawing',
      tools: [
        {
          type: TOOL_TYPES.PENCIL,
          icon: Pencil,
          label: TOOL_NAMES[TOOL_TYPES.PENCIL],
          shortcut: KEYBOARD_SHORTCUTS.PENCIL,
          available: availableTools.includes(TOOL_TYPES.PENCIL)
        },
      ]
    },
    {
      name: 'Shapes',
      tools: [
        {
          type: TOOL_TYPES.SHAPE,
          icon: Square,
          label: TOOL_NAMES[TOOL_TYPES.SHAPE],
          shortcut: KEYBOARD_SHORTCUTS.SHAPE,
          available: availableTools.includes(TOOL_TYPES.SHAPE)
        },
      ]
    },
    {
      name: 'Content',
      tools: [
        {
          type: TOOL_TYPES.TEXT,
          icon: Type,
          label: TOOL_NAMES[TOOL_TYPES.TEXT],
          shortcut: KEYBOARD_SHORTCUTS.TEXT,
          available: true
        },
        {
          type: TOOL_TYPES.IMAGE,
          icon: ImagePlus,
          label: TOOL_NAMES[TOOL_TYPES.IMAGE],
          shortcut: KEYBOARD_SHORTCUTS.IMAGE,
          available: true
        },
      ]
    },
    {
      name: 'Utility',
      tools: [
        {
          type: TOOL_TYPES.ERASER,
          icon: Eraser,
          label: TOOL_NAMES[TOOL_TYPES.ERASER],
          shortcut: KEYBOARD_SHORTCUTS.ERASER,
          available: true
        },
        {
          type: TOOL_TYPES.EMOJI,
          icon: Smile,
          label: TOOL_NAMES[TOOL_TYPES.EMOJI],
          shortcut: KEYBOARD_SHORTCUTS.EMOJI,
          available: true
        },
        {
          type: TOOL_TYPES.STICKY,
          icon: StickyNote,
          label: TOOL_NAMES[TOOL_TYPES.STICKY],
          shortcut: KEYBOARD_SHORTCUTS.STICKY,
          available: true
        },
      ]
    }
  ];

  const handleToolClick = (toolType, isAvailable) => {
    if (!isAvailable) return;
    if (toolType === TOOL_TYPES.IMAGE && toolManager && canvasManager) {
      try {
        const imageTool = toolManager.getToolInstance(TOOL_TYPES.IMAGE);
        if (imageTool) {
          if (typeof imageTool.requestOpenPicker === 'function') {
            imageTool.requestOpenPicker();
          }
          canvasManager.setActiveTool(imageTool);
        }
      } catch (error) {
        console.warn('Failed to activate image tool directly:', error);
      }
    }
    setActiveTool(toolType);
  };

  const getGridModeText = () => {
    switch (gridMode) {
      case GRID_MODES.NONE: return 'No Grid';
      case GRID_MODES.LINES: return 'Lines Grid';
      default: return 'Toggle Grid';
    }
  };

  return (
    <div className="fixed left-4 top-1/2 transform -translate-y-1/2 w-[52px] py-2 px-1.5 flex flex-col items-center gap-0.5 bg-card border border-border rounded-2xl shadow-xl z-50 select-none">
      {toolGroups.map((group, groupIndex) => (
        <div key={group.name} className="w-full flex flex-col items-center gap-0.5">
          {group.tools.map((tool) => {
            const isActive = activeTool === tool.type ||
              (tool.type === TOOL_TYPES.ERASER && activeTool === TOOL_TYPES.OBJECT_ERASER);
            return (
              <button
                key={tool.type}
                onClick={() => handleToolClick(tool.type, tool.available)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  !tool.available
                    ? 'opacity-30 cursor-not-allowed'
                    : isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                title={`${tool.label} (${tool.shortcut.toUpperCase()})${
                  !tool.available ? ' – Coming soon' : ''
                }`}
                disabled={!tool.available}
              >
                <tool.icon strokeWidth={1.75} className="w-[18px] h-[18px]" />
              </button>
            );
          })}

          {groupIndex < toolGroups.length - 1 && (
            <div className="w-5 h-px bg-border my-1" />
          )}
        </div>
      ))}

      <div className="w-5 h-px bg-border my-1" />

      {/* Minimap toggle */}
      <button
        onClick={toggleMinimap}
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
          isMinimapOpen
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
        title={`${isMinimapOpen ? 'Hide' : 'Show'} Minimap`}
      >
        <Map strokeWidth={1.75} className="w-[18px] h-[18px]" />
      </button>

      {/* Grid toggle */}
      <button
        onClick={toggleGridMode}
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
          gridMode && gridMode !== GRID_MODES.NONE
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
        title={getGridModeText()}
      >
        <Grid3x3 strokeWidth={1.75} className="w-[18px] h-[18px]" />
      </button>

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light'
          ? <Moon strokeWidth={1.75} className="w-[18px] h-[18px]" />
          : <Sun strokeWidth={1.75} className="w-[18px] h-[18px]" />}
      </button>
    </div>
  );
}