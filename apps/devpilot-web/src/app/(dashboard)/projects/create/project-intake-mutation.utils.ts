export async function mutate<T>(
  operation: () => Promise<T>,
  setMutating: (value: boolean) => void,
  setError: (value: string) => void,
) {
  setMutating(true);
  setError('');
  try {
    return await operation();
  } catch (caught) {
    setError(errorMessage(caught));
    return null;
  } finally {
    setMutating(false);
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
