import { PROJECT_TABLE_CLASS } from '../project-workbench-surface';
import { FlowStatusTag } from './release-flow-status-tag';

export interface ReleaseValidationEvidenceRow {
  key: string;
  check: string;
  object: string;
  result: string;
  tone: string;
  time: string;
}

export function ReleaseValidationEvidenceList(props: {
  rows: ReleaseValidationEvidenceRow[];
  columns: { check: string; object: string; result: string; time: string };
}) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {props.rows.map((row) => (
          <article
            key={row.key}
            className="rounded-lg border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-sm font-medium">{row.check}</h4>
              <FlowStatusTag
                status={row.tone}
                label={row.result}
              />
            </div>
            <dl className="mt-3 grid gap-3 text-xs">
              <Fact
                label={props.columns.object}
                value={row.object}
              />
              <Fact
                label={props.columns.time}
                value={row.time}
              />
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className={`${PROJECT_TABLE_CLASS} min-w-[680px]`}>
          <thead>
            <tr>
              <th>{props.columns.check}</th>
              <th>{props.columns.object}</th>
              <th>{props.columns.result}</th>
              <th>{props.columns.time}</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row) => (
              <tr key={row.key}>
                <td className="font-medium">{row.check}</td>
                <td>{row.object}</td>
                <td>
                  <FlowStatusTag
                    status={row.tone}
                    label={row.result}
                  />
                </td>
                <td>{row.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Fact(props: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{props.label}</dt>
      <dd className="mt-1 text-foreground">{props.value}</dd>
    </div>
  );
}
