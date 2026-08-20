export function ReleaseStagingSummary(props: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 px-3 py-3">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className="mt-1 break-all text-sm font-semibold">{props.value}</dd>
      {props.detail ? (
        <code className="mt-1 block break-all text-xs text-muted-foreground">{props.detail}</code>
      ) : null}
    </div>
  );
}
