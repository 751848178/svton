import React from 'react';
import { DesktopSessionSearchDialog } from './DesktopSessionSearchDialog';
import type { DesktopSessionSearchProps } from './desktop-session-search.types';

/** Desktop search entry point; dialog behavior is owned by focused peer modules. */
export function DesktopSessionSearch(props: DesktopSessionSearchProps) {
  return <DesktopSessionSearchDialog {...props} />;
}
