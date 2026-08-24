import React, {
  useState,
  useId,
  useRef,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useMemo,
} from 'react';
import type { Key, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { ChevronIcon } from '../../icons';

/**
 * Collapse 折叠面板
 *
 * Collapse 容器：accordion 单开 / activeKeys 受控；CollapseItem 亦可在容器外单独使用。
 * 头元素使用真实 <button>（原生 Enter/Space/焦点语义）；
 * 面板 region + aria-labelledby 关联头部。
 */

interface CollapseContextValue {
  openSet: ReadonlySet<Key>;
  toggle: (key: Key) => void;
  isDisabled?: (key: Key) => boolean;
}

const CollapseContext = createContext<CollapseContextValue | null>(null);

export interface CollapseItemProps {
  title: ReactNode;
  children: ReactNode;
  /** 容器内受控/open 集合所用键；容器外可省略 */
  itemKey?: Key;
  defaultOpen?: boolean;
  disabled?: boolean;
  extra?: ReactNode;
  className?: string;
}

export function CollapseItem(props: CollapseItemProps) {
  const { title, children, itemKey, defaultOpen = false, disabled = false, extra, className } = props;
  const ctx = useContext(CollapseContext);
  const fallbackId = useId();
  const key = itemKey ?? fallbackId;
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const [height, setHeight] = useState<number | 'auto'>(defaultOpen ? 'auto' : 0);
  const headerId = `${fallbackId}-header`;
  const panelId = `${fallbackId}-panel`;
  const contentRef = useRef<HTMLDivElement>(null);

  const open = ctx ? ctx.openSet.has(key) : localOpen;
  const resolvedDisabled = disabled || (ctx?.isDisabled?.(key) ?? false);
  const toggle = useCallback(() => {
    if (resolvedDisabled) return;
    if (ctx) ctx.toggle(key);
    else setLocalOpen((prev) => !prev);
  }, [ctx, key, resolvedDisabled]);

  useEffect(() => {
    if (!contentRef.current) return;

    const el = contentRef.current;
    if (open) {
      el.style.height = 'auto';
      const naturalHeight = el.scrollHeight;
      el.style.height = '0px';
      el.offsetHeight; // force reflow
      el.style.height = naturalHeight + 'px';
      const onEnd = () => {
        el.style.height = 'auto';
        setHeight('auto');
        el.removeEventListener('transitionend', onEnd);
      };
      el.addEventListener('transitionend', onEnd);
    } else {
      const currentHeight = el.scrollHeight;
      el.style.height = currentHeight + 'px';
      el.offsetHeight; // force reflow
      el.style.height = '0px';
    }
  }, [open]);

  return (
    <div className={cn('border-b border-border', className)}>
      <h3 className="m-0">
        <button
          type="button"
          id={headerId}
          disabled={resolvedDisabled}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className={cn(
            'flex w-full items-center justify-between px-4 py-3 select-none rounded-sm bg-transparent text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            resolvedDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          )}
        >
          <span className="flex items-center gap-2">
            <ChevronIcon
              size={12}
              aria-hidden="true"
              className={cn('transition-transform duration-200', open && 'rotate-90')}
            />
            <span className="font-medium">{title}</span>
          </span>
          {extra}
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        ref={contentRef}
        className="collapse-panel"
        style={{ height: height === 'auto' ? 'auto' : height }}
      >
        <div className="px-4 pb-4 pl-9">{children}</div>
      </div>
    </div>
  );
}

export interface CollapseProps {
  children: ReactNode;
  bordered?: boolean;
  /** 手风琴：同时只展开一项 */
  accordion?: boolean;
  /** 受控展开键集合 */
  activeKeys?: Key[];
  defaultActiveKeys?: Key[];
  onChange?: (keys: Key[]) => void;
  className?: string;
}

export function Collapse(props: CollapseProps) {
  const {
    children,
    bordered = true,
    accordion = false,
    activeKeys: controlledKeys,
    defaultActiveKeys = [],
    onChange,
    className,
  } = props;
  const [internalKeys, setInternalKeys] = useState<Key[]>(defaultActiveKeys);

  const openSet = useMemo(
    () => new Set<Key>(controlledKeys ?? internalKeys),
    [controlledKeys, internalKeys],
  );

  const toggle = useCallback(
    (key: Key) => {
      const nextOpen = !openSet.has(key);
      let next: Key[];
      if (accordion) next = nextOpen ? [key] : [];
      else next = nextOpen ? [...openSet, key] : [...openSet].filter((k) => k !== key);
      if (controlledKeys === undefined) setInternalKeys(next);
      onChange?.(next);
    },
    [accordion, openSet, controlledKeys, onChange],
  );

  const contextValue = useMemo<CollapseContextValue>(
    () => ({ openSet, toggle }),
    [openSet, toggle],
  );

  return (
    <CollapseContext.Provider value={contextValue}>
      <div className={cn(bordered && 'border border-border rounded-lg overflow-hidden', className)}>
        {children}
      </div>
    </CollapseContext.Provider>
  );
}
