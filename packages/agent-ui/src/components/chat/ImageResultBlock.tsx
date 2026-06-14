import React, { useState } from 'react';

export interface GeneratedImage {
  url?: string;
  base64?: string;
  revisedPrompt?: string;
}

export interface ImageResultBlockProps {
  images: GeneratedImage[];
  model: string;
  className?: string;
}

function downloadImage(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Displays AI-generated images inline in the chat.
 * Supports both URL and base64-encoded images.
 */
export const ImageResultBlock: React.FC<ImageResultBlockProps> = ({
  images,
  model,
  className,
}) => {
  const [showPrompt, setShowPrompt] = useState<number | null>(null);

  if (images.length === 0) return null;

  return (
    <div className={`svton-image-result rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#252525]">
        <span className="text-xs font-semibold text-gray-300">
          {images.length} {images.length === 1 ? 'Image' : 'Images'} Generated
        </span>
        <span className="text-[10px] text-gray-500 ml-auto">{model}</span>
      </div>

      {/* Images grid */}
      <div className="p-2 grid gap-2" style={{
        gridTemplateColumns: images.length > 1 ? '1fr 1fr' : '1fr',
      }}>
        {images.map((img, idx) => {
          const src = img.url
            ? img.url
            : img.base64
              ? img.base64.startsWith('data:')
                ? img.base64
                : `data:image/png;base64,${img.base64}`
              : '';

          if (!src) return null;

          return (
            <div key={idx} className="svton-image-result-item relative group rounded-md overflow-hidden border border-[#252525]">
              <img
                src={src}
                alt={img.revisedPrompt ?? `Generated image ${idx + 1}`}
                className="w-full h-auto block"
                style={{ maxHeight: '320px', objectFit: 'contain', backgroundColor: '#111' }}
              />

              {/* Overlay actions */}
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {img.revisedPrompt && (
                  <button
                    className="svton-image-result-prompt-btn bg-black/70 hover:bg-black/90 text-gray-300 text-[10px] px-1.5 py-0.5 rounded"
                    onClick={() => setShowPrompt(showPrompt === idx ? null : idx)}
                    title="Show revised prompt"
                  >
                    Prompt
                  </button>
                )}
                <button
                  className="svton-image-result-download-btn bg-black/70 hover:bg-black/90 text-gray-300 text-[10px] px-1.5 py-0.5 rounded"
                  onClick={() => downloadImage(src, `svton-image-${Date.now()}-${idx + 1}.png`)}
                  title="Download image"
                >
                  ↓
                </button>
              </div>

              {/* Revised prompt caption */}
              {img.revisedPrompt && showPrompt === idx && (
                <div className="px-2 py-1 text-[10px] text-gray-400 bg-[#1a1a1a]/95 border-t border-[#252525]">
                  <span className="text-gray-500">Prompt: </span>
                  {img.revisedPrompt}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
