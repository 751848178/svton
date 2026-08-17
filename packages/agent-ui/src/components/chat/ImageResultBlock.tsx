import React, { useState } from 'react';
import { DownloadIcon, EyeIcon, EyeOffIcon, useI18n } from '@svton/ui';

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
  const { translate: t } = useI18n();
  const [showPrompt, setShowPrompt] = useState<number | null>(null);

  if (images.length === 0) return null;

  return (
    <div className={`svton-image-result overflow-hidden rounded-lg border border-border bg-card ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <span className="text-xs font-semibold text-foreground">
          {images.length} {images.length === 1 ? t('chat.generatedImage') : t('chat.generatedImages')}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">{model}</span>
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
            <div key={idx} className="svton-image-result-item group/image relative overflow-hidden rounded-md border border-border">
              <img
                src={src}
                alt={img.revisedPrompt ?? `${t('chat.generatedImageAlt')} ${idx + 1}`}
                className="w-full h-auto block"
                style={{ maxHeight: '320px', objectFit: 'contain' }}
              />

              {/* Overlay actions */}
              <div className="pointer-events-none absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-focus-within/image:pointer-events-auto group-focus-within/image:opacity-100 group-hover/image:pointer-events-auto group-hover/image:opacity-100">
                {img.revisedPrompt && (
                  <button
                    className="svton-image-result-prompt-btn flex h-11 w-11 items-center justify-center rounded-lg bg-card/90 text-foreground hover:bg-accent"
                    onClick={() => setShowPrompt(showPrompt === idx ? null : idx)}
                    aria-label={showPrompt === idx ? t('action.hidePrompt') : t('action.showPrompt')}
                  >
                    {showPrompt === idx
                      ? <EyeOffIcon size={16} aria-hidden="true" />
                      : <EyeIcon size={16} aria-hidden="true" />}
                  </button>
                )}
                <button
                  className="svton-image-result-download-btn flex h-11 w-11 items-center justify-center rounded-lg bg-card/90 text-foreground hover:bg-accent"
                  onClick={() => downloadImage(src, `svton-image-${Date.now()}-${idx + 1}.png`)}
                  aria-label={t('action.downloadImage')}
                >
                  <DownloadIcon size={16} aria-hidden="true" />
                </button>
              </div>

              {/* Revised prompt caption */}
              {img.revisedPrompt && showPrompt === idx && (
                <div className="border-t border-border bg-card/95 px-2 py-1 text-[10px] text-muted-foreground">
                  <span>{t('chat.revisedPrompt')}: </span>
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
