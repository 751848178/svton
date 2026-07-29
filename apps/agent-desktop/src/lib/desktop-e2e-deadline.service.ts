export function awaitDesktopE2eDeadline<T>(
  operation: () => Promise<T>,
  deadline: number,
  label: string,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(new Error(`Desktop E2E timed out waiting for ${label}`));
      return;
    }
    if (signal?.aborted) {
      reject(new Error(`Desktop E2E cancelled during ${label}`));
      return;
    }
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Desktop E2E timed out waiting for ${label}`));
    }, remaining);
    const cancel = () => {
      cleanup();
      reject(new Error(`Desktop E2E cancelled during ${label}`));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', cancel);
    };
    signal?.addEventListener('abort', cancel, { once: true });
    Promise.resolve().then(operation).then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}
