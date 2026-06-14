import React from 'react';
import { cn } from '@svton/ui';

export interface ScreenshotViewProps {
  /** Raw JSON string: {type:'image', data:string, mimeType:string} */
  output: string;
  className?: string;
}

/** Detect if a tool output string contains an image payload */
export function isImageOutput(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  // Fast check before expensive JSON.parse
  if (!text.includes('"image"')) return false;
  try {
    let parsed: any = JSON.parse(text);
    // Handle double-stringified JSON (from serialization round-trips)
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    return parsed?.type === 'image' && typeof parsed?.data === 'string';
  } catch {
    return false;
  }
}

/** Parse image data from tool output, handling double-stringified JSON */
function parseImageData(text: string): { type: string; data: string; mimeType?: string } | null {
  try {
    let parsed: any = JSON.parse(text);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    if (parsed?.type === 'image' && typeof parsed?.data === 'string') {
      return parsed;
    }
  } catch {
    // Not JSON
  }
  return null;
}

/**
 * Renders a base64-encoded screenshot image from tool output.
 * Follows the DiffView pattern: detection function + rendering component.
 */
export const ScreenshotView: React.FC<ScreenshotViewProps> = ({ output, className }) => {
  const parsed = parseImageData(output);
  if (!parsed) {
    return (
      <pre className="text-xs text-red-400 bg-red-950/30 rounded-md px-3 py-1.5 border border-red-900/30">
        Failed to parse image data
      </pre>
    );
  }

  const src = parsed.data.startsWith('data:') || parsed.data.startsWith('http')
    ? parsed.data
    : `data:${parsed.mimeType || 'image/png'};base64,${parsed.data}`;

  return (
    <div className={cn('rounded-lg overflow-hidden border border-[#2a2a2a] my-1', className)}>
      <img
        src={src}
        alt="Screenshot"
        className="max-w-full max-h-96 object-contain bg-[#111]"
        loading="lazy"
      />
    </div>
  );
};
