import { UploadCloud } from 'lucide-react';

export default function CanvasDropOverlay({ dragDropState }) {
  if (!dragDropState?.active) return null;

  const { isValid, x = 0, y = 0 } = dragDropState;

  return (
    <div className="pointer-events-none absolute inset-0 z-[95]">
      <div className={`absolute inset-0 transition-colors duration-150 ${isValid ? 'bg-blue-500/8' : 'bg-red-500/10'}`} />

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={[
            'w-[min(92vw,460px)] rounded-2xl border-2 border-dashed px-6 py-7 text-center shadow-xl',
            'transition-all duration-150',
            isValid ? 'border-blue-400 bg-white/90 text-blue-900' : 'border-red-400 bg-white/92 text-red-900',
          ].join(' ')}
        >
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
            <UploadCloud className={`h-5 w-5 ${isValid ? 'text-blue-600' : 'text-red-600'}`} />
          </div>
          <div className="text-base font-semibold">
            {isValid ? 'Drop image to upload' : 'Unsupported file type'}
          </div>
          <div className="mt-1 text-sm opacity-80">
            {isValid ? 'PNG, JPG, GIF, WEBP, SVG, BMP' : 'Only image files can be uploaded'}
          </div>
        </div>
      </div>

      <div
        className="absolute h-6 w-6 rounded-full border border-white/80 bg-blue-500/30 shadow-md"
        style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
      />
    </div>
  );
}
