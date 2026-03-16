import { X } from 'lucide-react';

export default function ExportProgressOverlay({ isExporting, processed = 0, total = 0, onCancel }) {
  if (!isExporting) return null;

  const safeTotal = Math.max(0, total || 0);
  const safeProcessed = Math.min(Math.max(0, processed || 0), safeTotal || 0);
  const percent = safeTotal > 0 ? Math.round((safeProcessed / safeTotal) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <div className="absolute top-0 left-0 right-0 h-1 bg-primary/80 animate-pulse" />
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Exporting SVG...</h2>
            <p className="text-sm text-muted-foreground">Processed {safeProcessed} / {safeTotal}</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            title="Cancel export"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Export in progress. Leaving will cancel download.</p>
      </div>
    </div>
  );
}
