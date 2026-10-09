import { Suspense } from 'react';
import { PlatformApp } from '@/components/platform-app';

export default function Page() {
  return <Suspense fallback={<main className="boot-state">正在读取本机发布工作台…</main>}><PlatformApp /></Suspense>;
}
