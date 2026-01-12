/**
 * useTextSelection
 * 获取用户选中的文本
 *
 * @example
 * const { text, rects } = useTextSelection();
 *
 * // 显示选中文本的工具栏
 * {text && (
 *   <Toolbar style={{ top: rects[0]?.top, left: rects[0]?.left }}>
 *     <button onClick={() => copy(text)}>复制</button>
 *     <button onClick={() => search(text)}>搜索</button>
 *   </Toolbar>
 * )}
 */

import { useState, useEffect, RefObject } from 'react';

export interface TextSelectionState {
  text: string;
  rects: DOMRect[];
  ranges: Range[];
}

const initialState: TextSelectionState = {
  text: '',
  rects: [],
  ranges: [],
};

export function useTextSelection(
  target?: RefObject<Element | null>,
): TextSelectionState {
  const [state, setState] = useState<TextSelectionState>(initialState);

  useEffect(() => {
    const getSelectionState = (): TextSelectionState => {
      const selection = window.getSelection();

      if (!selection || selection.rangeCount === 0) {
        return initialState;
      }

      const text = selection.toString();

      if (!text) {
        return initialState;
      }

      // 如果指定了 target，检查选区是否在 target 内
      if (target?.current) {
        const range = selection.getRangeAt(0);
        if (!target.current.contains(range.commonAncestorContainer)) {
          return initialState;
        }
      }

      const ranges: Range[] = [];
      const rects: DOMRect[] = [];

      for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        ranges.push(range);
        const rectList = range.getClientRects();
        for (let j = 0; j < rectList.length; j++) {
          rects.push(rectList[j]);
        }
      }

      return { text, rects, ranges };
    };

    const handleSelectionChange = () => {
      setState(getSelectionState());
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [target]);

  return state;
}
