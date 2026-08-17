import React from 'react';
import {
  CloseIcon,
  CollapseSidebarIcon,
  ExpandSidebarIcon,
  PlusIcon,
  SettingsIcon,
} from '@svton/ui';

const iconProps = { size: 14, 'aria-hidden': true } as const;

export const sidebarIcons = {
  settings: <SettingsIcon {...iconProps} strokeWidth={1.5} />,
  newChat: <PlusIcon {...iconProps} strokeWidth={2} />,
  collapse: <CollapseSidebarIcon {...iconProps} strokeWidth={1.5} />,
  expand: <ExpandSidebarIcon {...iconProps} strokeWidth={1.5} />,
  close: <CloseIcon {...iconProps} strokeWidth={2} />,
};
