# @svton/ui

React UI components library with Tailwind CSS support.

## Installation

```bash
pnpm add @svton/ui
```

## Usage

### Tailwind preset

```js
// tailwind.config.js
module.exports = {
  presets: [require('@svton/ui/tailwind-preset')],
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
};
```

```tsx
import { Card, Modal, Tabs } from '@svton/ui';
```

### Prebuilt CSS

```tsx
import '@svton/ui/styles.css';
import { Card, Tag } from '@svton/ui';
```

## Included primitives

- Request and state feedback: `LoadingState`, `EmptyState`, `ErrorState`, `ProgressState`, `PermissionState`, `RequestBoundary`
- Overlays and feedback: `Modal`, `Drawer`, `Tooltip`, `Popover`, `Notification`, `Spin`
- Data display: `Skeleton`, `Avatar`, `Badge`, `Tag`, `Card`, `Collapse`, `Tabs`, `Divider`
- Layout and utility: `Portal`, `AspectRatio`, `ScrollArea`, `InfiniteScroll`, `Copyable`, `VisuallyHidden`, `ClickOutside`

## Utilities

```tsx
import { cn } from '@svton/ui';
```

## Documentation

Full package documentation lives in the monorepo docs at `docs/packages/ui.md`.
