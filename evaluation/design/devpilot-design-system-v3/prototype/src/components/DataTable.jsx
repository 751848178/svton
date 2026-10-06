import { SectionHeading } from './ui.jsx';

export function DataTable({ columns, children, className = '', wrapperClassName = '', label }) {
  return (
    <div className={`data-table-wrap ${wrapperClassName}`.trim()}>
      <table className={`data-table ${className}`.trim()} aria-label={label}>
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function DataTableSurface({ title, meta, actions, columns, children, className = '', tableClassName = '', label }) {
  return (
    <section className={`surface table-surface ${className}`.trim()}>
      {(title || meta || actions) && <SectionHeading title={title} meta={meta} actions={actions} />}
      <DataTable columns={columns} className={tableClassName} label={label ?? title}>{children}</DataTable>
    </section>
  );
}
