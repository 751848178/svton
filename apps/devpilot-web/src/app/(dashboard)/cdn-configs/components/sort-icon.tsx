/** 表头排序指示：升序/降序/可排序三态 chevron（lucide 风格内联 SVG，无图标库依赖）。 */

export function SortIcon({ state }: { state: false | 'asc' | 'desc' }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-muted-foreground"
    >
      {state === 'asc' ? (
        <path d="m18 15-6-6-6 6" />
      ) : state === 'desc' ? (
        <path d="m6 9 6 6 6-6" />
      ) : (
        <>
          <path d="m7 15 5-5 5 5" />
          <path d="m7 9 5 5 5-5" opacity="0.4" />
        </>
      )}
    </svg>
  );
}
