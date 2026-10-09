'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { request } from '@/lib/api';
import { SessionController } from './session-controller';

export function useAuthSession() {
  const [controller] = useState(() => new SessionController((route, input) => request(route, input as never)));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  useEffect(() => {
    const stop = controller.start();
    const focus = () => { if (document.visibilityState === 'visible' && controller.getSnapshot().status === 'authenticated') void controller.refresh(); };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => { stop(); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [controller]);
  return { state, controller };
}
