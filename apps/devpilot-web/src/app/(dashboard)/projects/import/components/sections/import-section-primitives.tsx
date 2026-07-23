/**
 * 项目接入表单分区共享原语
 *
 * 单一职责：分区外壳、建议列表、锚点清单等被各分区复用的展示原语与共享 props。
 */

import type { ReactNode } from 'react';
import type { ImportProjectForm, EnvironmentKey } from '../../types';

/** 各分区共享的表单 props。 */
export interface SectionProps {
  form: ImportProjectForm;
  onChange: (patch: Partial<ImportProjectForm>) => void;
  onToggleEnvironment: (env: EnvironmentKey) => void;
}

/** 表单分区外壳：统一 id（供顶部锚点跳转）+ 标题 + 内容。 */
export function SectionShell({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-4 rounded-lg border p-6"
    >
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** 各分区锚点（id + 标题），供页面顶部跳转列表复用。 */
export const IMPORT_SECTION_ANCHORS: Array<{ id: string; titleKey: string }> = [
  { id: 'scope', titleKey: 'scopeSectionTitle' },
  { id: 'basic', titleKey: 'basicInfoSectionTitle' },
  { id: 'repo-stack', titleKey: 'repoStackSectionTitle' },
  { id: 'deploy', titleKey: 'deploySectionTitle' },
  { id: 'environment', titleKey: 'environmentSectionTitle' },
];

/** 免输入建议列表：保持自由文本输入，同时提供常用选项下拉提示。 */
export function SuggestionDatalist({ id, options }: { id: string; options: string[] }) {
  return (
    <datalist id={id}>
      {options.map((opt) => (
        <option
          key={opt}
          value={opt}
        />
      ))}
    </datalist>
  );
}
