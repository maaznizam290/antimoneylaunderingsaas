/// SQLite has no native Json column type, so array/object fields are stored
/// as JSON text (see prisma/schema.prisma). These two helpers are the only
/// place that (de)serialization happens.
export function toJsonText(value: unknown): string {
  return JSON.stringify(value);
}

export function fromJsonText<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
