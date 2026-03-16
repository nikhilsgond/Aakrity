  import { useUIStore } from '@app/state/uiStore';
import { Image, Codepen, FileJson, X } from 'lucide-react';

  const ExportModal = ({ onExport }) => {
  const { isExportModalOpen, closeExportModal } = useUIStore();

  if (!isExportModalOpen) {
    return null;
  }

  const exportOptions = [
    {
      id: 'png',
      name: 'PNG Image',
      description: 'High-quality raster image',
      icon: Image,
      color: 'text-blue-500',
      action: () => {
        onExport?.('png');
        closeExportModal();
      },
    },
    {
      id: 'svg',
      name: 'SVG Vector',
      description: 'Scalable vector format',
      icon: Codepen,
      color: 'text-green-500',
      action: () => {
        onExport?.('svg');
        closeExportModal();
      },
    },
    {
      id: 'json',
      name: 'JSON Data',
      description: 'Canvas data for reimport',
      icon: FileJson,
      color: 'text-purple-500',
      action: () => {
        onExport?.('json');
        closeExportModal();
      },
    },
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-100"
      onClick={closeExportModal}
    >
      <div 
        className="bg-card rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Export Canvas</h2>
          <button 
            onClick={closeExportModal}
            className="p-2 rounded-full hover:bg-muted"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="space-y-3">
          {exportOptions.map((option) => (
            <button
              key={option.id}
              onClick={option.action}
              className="w-full p-4 border border-border rounded-lg flex items-center justify-between hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <option.icon className={`w-5 h-5 ${option.color}`} />
                <div className="text-left">
                  <p className="font-medium">{option.name}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExportModal;