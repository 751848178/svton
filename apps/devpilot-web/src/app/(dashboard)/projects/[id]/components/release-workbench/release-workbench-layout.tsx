import type { ReactNode } from 'react';

export function ReleaseWorkbenchLayout({
  main,
  rail,
}: {
  main: ReactNode;
  rail: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] xl:items-start">
      <div className="min-w-0">{main}</div>
      <aside
        className="min-w-0 xl:sticky xl:top-4"
        aria-labelledby="release-workbench-rail-title"
      >
        {rail}
      </aside>
    </div>
  );
}
