'use client';

import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const AgentChat = dynamic(() => import('@/components/AgentChat'), { ssr: false });

export default function Home() {
  return (
    <ErrorBoundary>
      <AgentChat />
    </ErrorBoundary>
  );
}
