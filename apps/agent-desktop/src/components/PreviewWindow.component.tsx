import { useEffect, useState } from 'react';
import {
  SplitScreenPanel,
  type SplitScreenContent,
} from '@svton/agent-ui';

export function PreviewWindow() {
  const [content, setContent] = useState<SplitScreenContent | null>(null);

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get('key');
    if (!key) return;
    const storageKey = `svton-preview-${key}`;
    let attempts = 0;
    const tryRead = () => {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          setContent(JSON.parse(stored) as SplitScreenContent);
          localStorage.removeItem(storageKey);
        } catch {
          // Ignore malformed disposable preview content.
        }
      } else if (attempts < 20) {
        attempts += 1;
        setTimeout(tryRead, 100);
      }
    };
    tryRead();
  }, []);

  return (
    <div className="h-screen bg-[#2a2a2a] text-gray-100">
      <SplitScreenPanel
        content={content}
        readOnly
        onClose={() => {
          void (async () => {
            try {
              const { getCurrentWindow } = await import('@tauri-apps/api/window' as string);
              getCurrentWindow().close();
            } catch {
              window.close();
            }
          })();
        }}
      />
    </div>
  );
}
