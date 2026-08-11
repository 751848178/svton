export function ReleaseProductionOperationErrors(props: {
  productionError: string;
  promotionError: string;
  reconciliationError: string;
}) {
  return <>
    {[props.productionError, props.promotionError, props.reconciliationError]
      .filter(Boolean)
      .map((error) => (
        <p key={error} className="text-sm text-destructive" role="alert">{error}</p>
      ))}
  </>;
}
