import { useCallback, useState, type RefObject } from 'react';

export function useComposerHistory(
  value: string,
  setValue: (value: string) => void,
  history: string[],
  textareaRef: RefObject<HTMLTextAreaElement | null>,
) {
  const [index, setIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const reset = useCallback(() => { setIndex(null); setDraft(''); }, []);
  const apply = useCallback((next: string) => {
    setValue(next);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(next.length, next.length);
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    });
  }, [setValue, textareaRef]);
  const navigate = useCallback((direction: 'previous' | 'next') => {
    if (!history.length) return false;
    if (direction === 'previous') {
      const next = index === null ? history.length - 1 : Math.max(0, index - 1);
      if (index === null) setDraft(value);
      setIndex(next);
      apply(history[next]);
      return true;
    }
    if (index === null) return false;
    if (index < history.length - 1) {
      const next = index + 1;
      setIndex(next);
      apply(history[next]);
      return true;
    }
    setIndex(null);
    apply(draft);
    setDraft('');
    return true;
  }, [apply, draft, history, index, value]);
  return { navigate, reset };
}
