import React, { useState, useEffect, Dispatch, ReactNode } from 'react';
import type { SetStateAction } from 'react';
import { cn } from '../../lib/utils';
import { Portal } from '../Portal';
import { NotificationItem, NotificationProps, NotificationPlacement } from './NotificationItem';

interface NotificationData {
  id: string;
  key?: string;
  config: NotificationProps;
}

type DispatchSet = Dispatch<SetStateAction<NotificationData[]>>;

/** 容器注册表：placement -> dispatch；多容器互不干扰，卸载自动注销。 */
const containerRegistry = new Map<NotificationPlacement, DispatchSet>();

function registerContainer(
  placement: NotificationPlacement,
  dispatch: DispatchSet,
): () => void {
  containerRegistry.set(placement, dispatch);
  return () => {
    if (containerRegistry.get(placement) === dispatch) containerRegistry.delete(placement);
  };
}

function openNotification(config: NotificationProps) {
  const placement = config.placement ?? 'topRight';
  const dispatch = containerRegistry.get(placement);
  if (!dispatch) return;
  const id = Math.random().toString(36).slice(2);
  dispatch((prev) => {
    const existing = config.key ? prev.findIndex((n) => n.key === config.key) : -1;
    if (existing >= 0) {
      const next = [...prev];
      next[existing] = { id, key: config.key, config };
      return next;
    }
    return [...prev, { id, key: config.key, config }];
  });
}

function closeByKey(key: string) {
  for (const dispatch of containerRegistry.values()) {
    dispatch((prev) => prev.filter((n) => n.key !== key));
  }
}

function closeById(id: string) {
  for (const dispatch of containerRegistry.values()) {
    dispatch((prev) => prev.filter((n) => n.id !== id));
  }
}

function closeAll() {
  for (const dispatch of containerRegistry.values()) dispatch([]);
}

export function NotificationContainer({
  placement = 'topRight',
  maxCount = 5,
}: {
  placement?: NotificationPlacement;
  maxCount?: number;
}) {
  const [items, setItems] = useState<NotificationData[]>([]);

  useEffect(() => registerContainer(placement, setItems), [placement]);

  return (
    <Portal>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className={cn(
          'fixed z-[2000] flex flex-col gap-3',
          placement.includes('top') ? 'top-6' : 'bottom-6',
          placement.includes('Right') ? 'right-6' : 'left-6',
        )}
      >
        {items.slice(-maxCount).map((item) => {
          const { key: _idempotencyKey, placement: _placement, ...restConfig } = item.config;
          return (
            <NotificationItem
              key={item.id}
              {...restConfig}
              announce={false}
              onClose={() => setItems((prev) => prev.filter((n) => n.id !== item.id))}
            />
          );
        })}
      </div>
    </Portal>
  );
}

export const notification = {
  open: openNotification,
  close: closeByKey,
  closeId: closeById,
  closeAll: closeAll,
  info: (config: Omit<NotificationProps, 'type'>) => openNotification({ ...config, type: 'info' }),
  success: (config: Omit<NotificationProps, 'type'>) => openNotification({ ...config, type: 'success' }),
  warning: (config: Omit<NotificationProps, 'type'>) => openNotification({ ...config, type: 'warning' }),
  error: (config: Omit<NotificationProps, 'type'>) => openNotification({ ...config, type: 'error' }),
};

export type { NotificationProps, NotificationPlacement };

/** @deprecated Use notification.open() or NotificationContainer instead. This component is for internal use. */
export const Notification = NotificationItem;
