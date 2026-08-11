export function ReleaseStagingSummary(props: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md border p-3">
      <span className="text-xs text-muted-foreground">{props.label}</span>
      <strong className="mt-1 block break-all text-sm">{props.value}</strong>
      {props.detail ? (
        <code className="mt-1 block break-all text-xs text-muted-foreground">{props.detail}</code>
      ) : null}
    </div>
  );
}
