import type { Project } from '@/lib/contracts';

export function ProjectBreadcrumbs({ project, current, parent, disabled }: {
  project: Project; current?: string; parent?: 'history'; disabled?: boolean;
}) {
  const block = (event: React.MouseEvent) => { if (disabled) event.preventDefault(); };
  return <nav className="breadcrumbs" aria-label="当前位置">
    <a href="/?view=projects" onClick={block} aria-disabled={disabled}>项目</a><span aria-hidden="true">›</span>
    <a href={`/?view=overview&project=${encodeURIComponent(project.id)}`} onClick={block} aria-disabled={disabled}>{project.name}</a>
    {parent && <><span aria-hidden="true">›</span><a href={`/?view=history&project=${encodeURIComponent(project.id)}`} onClick={block} aria-disabled={disabled}>发布记录</a></>}
    {current && <><span aria-hidden="true">›</span><span aria-current="page">{current}</span></>}
  </nav>;
}
