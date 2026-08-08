export function finalSiteUrl(
  primaryDomain: string | null,
  tlsRequired?: boolean | null,
): string | null {
  if (!primaryDomain) return null;
  return normalizeFinalUrl(
    `${tlsRequired === false ? "http" : "https"}://${primaryDomain}`,
  );
}

export function normalizeFinalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
