/** Validate a post-login redirect target as a same-origin relative path. */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function readNextFromLocation(search: string): string | null {
  try {
    return safeNext(new URLSearchParams(search).get("next"));
  } catch {
    return null;
  }
}
