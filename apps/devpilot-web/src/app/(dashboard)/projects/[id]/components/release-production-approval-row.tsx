interface Props {
  label: string;
  value: string;
}

export function ReleaseProductionApprovalRow({ label, value }: Props) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 rounded bg-muted/40 p-2">
      <dt className="font-medium">{label}</dt>
      <dd className="break-all font-mono text-xs text-muted-foreground">{value}</dd>
    </div>
  );
}
