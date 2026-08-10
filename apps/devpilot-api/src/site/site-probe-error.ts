export function probeError(error: unknown): {
  code: string;
  message: string;
} {
  const value = error as { code?: unknown; message?: unknown };
  return {
    code: typeof value?.code === "string" ? value.code : "PROBE_ERROR",
    message:
      typeof value?.message === "string" ? value.message : "probe failed",
  };
}

export function withProbeTimeout<T>(
  promise: Promise<T>,
  ms: number,
  code: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Object.assign(new Error(code), { code })),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
