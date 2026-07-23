/**
 * 回退箭头图标
 *
 * 单一职责：内联 SVG 回退箭头（项目未引入图标库，与 nav-icons 的 24x24 stroke 风格一致）。
 */

export function BackArrowIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}
