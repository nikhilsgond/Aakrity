import { useUIStore } from '@app/state/uiStore';
import { KEYBOARD_SHORTCUTS, TOOL_TYPES } from '@shared/constants';
import { X } from 'lucide-react';

const ShortcutsModal = () => {
  const { isShortcutsModalOpen, closeShortcutsModal } = useUIStore();

  if (!isShortcutsModalOpen) {
    return null;
  }

  const shortcuts = [
    { category: 'Tools', items: [
      { name: 'Select', keys: [KEYBOARD_SHORTCUTS.SELECT] },
      { name: 'Pan', keys: [KEYBOARD_SHORTCUTS.PAN] },
      { name: 'Pencil', keys: [KEYBOARD_SHORTCUTS.PENCIL] },
      { name: 'Rectangle', keys: [KEYBOARD_SHORTCUTS.RECTANGLE] },
      { name: 'Circle', keys: [KEYBOARD_SHORTCUTS.CIRCLE] },
      { name: 'Line', keys: [KEYBOARD_SHORTCUTS.LINE] },
      { name: 'Arrow', keys: [KEYBOARD_SHORTCUTS.ARROW] },
      { name: 'Text', keys: [KEYBOARD_SHORTCUTS.TEXT] },
      { name: 'Eraser', keys: [KEYBOARD_SHORTCUTS.ERASER] },
      { name: 'Emoji', keys: [KEYBOARD_SHORTCUTS.EMOJI] },
      { name: 'Sticky Note', keys: [KEYBOARD_SHORTCUTS.STICKY] },
      { name: 'Insert Image', keys: [KEYBOARD_SHORTCUTS.IMAGE] },
    ]},
    { category: 'Actions', items: [
      { name: 'Undo', keys: ['Ctrl', 'Z'] },
      { name: 'Redo', keys: ['Ctrl', 'Shift', 'Z'] },
      { name: 'Delete', keys: ['Delete'] },
      { name: 'Zoom In', keys: ['Ctrl', '+'] },
      { name: 'Zoom Out', keys: ['Ctrl', '-'] },
      { name: 'Reset View', keys: ['Ctrl', '0'] },
      { name: 'Toggle Grid', keys: ['Ctrl', 'G'] },
      { name: 'Toggle Shortcuts', keys: ['?'] },
    ]},
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-100"
      onClick={closeShortcutsModal}
    >
      <div 
        className="bg-card rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Keyboard Shortcuts</h2>
          <button 
            onClick={closeShortcutsModal}
            className="p-2 rounded-full hover:bg-muted"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {shortcuts.map((category) => (
            <div key={category.category}>
              <h3 className="font-semibold mb-4 text-lg">{category.category}</h3>
              <div className="space-y-3">
                {category.items.map((item) => (
                  <div key={item.name} className="flex justify-between items-center">
                    <span className="text-sm">{item.name}</span>
                    <div className="flex gap-1">
                      {item.keys.map((key, index) => (
                        <kbd 
                          key={index}
                          className="px-2 py-1 bg-muted rounded text-xs font-mono min-w-[28px] text-center"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 pt-4 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            Press <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">?</kbd> to show/hide this modal
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsModal;