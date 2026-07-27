'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { readResourceRequestEntry } from '../utils/resource-request-entry.utils';

export function useResourceRequestEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entry = useMemo(() => readResourceRequestEntry(searchParams), [searchParams]);
  const [showModal, setShowModal] = useState(entry.shouldCreate);

  useEffect(() => {
    if (entry.shouldCreate) setShowModal(true);
  }, [entry.shouldCreate]);

  const finishCreate = () => {
    setShowModal(false);
    if (entry.returnTo) router.push(entry.returnTo);
  };

  return { entry, showModal, setShowModal, finishCreate };
}
