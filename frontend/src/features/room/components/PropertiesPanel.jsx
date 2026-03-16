// src/components/panels/PropertiesPanel.jsx - SIMPLE VERSION
import { useUIStore } from '@app/state/uiStore';
import { Sliders, X } from 'lucide-react';

const PropertiesPanel = () => {
  const { isPropertiesPanelOpen, setPropertiesPanelOpen } = useUIStore();
  
  if (!isPropertiesPanelOpen) {
    return null;
  }

  return (
    <div className="fixed right-4 top-1/2 transform -translate-y-1/2 w-60 bg-card border border-border rounded-xl shadow-lg z-ui overflow-y-auto panel-scrollbar max-h-[60vh] animate-fade-in">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4" />
            <h3 className="font-semibold">Properties</h3>
          </div>
          <button
            onClick={() => setPropertiesPanelOpen(false)}
            className="p-1 rounded-full hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-sm text-muted-foreground text-center py-8">
          Select an object to view and edit its properties.
          <br />
          <span className="text-xs">(Selection coming soon)</span>
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;