'use client';

import { useContext } from 'react';
import { I18nContext } from './LocaleProvider';

export function useI18n() {
  return useContext(I18nContext);
}
