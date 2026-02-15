type ErrorShape = {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
};

function toText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function formatSupabaseError(error: unknown, fallback: string): string {
  const shape = (error && typeof error === 'object' ? error : {}) as ErrorShape;

  const message = toText(shape.message) || fallback;
  const code = toText(shape.code);
  const details = toText(shape.details);
  const hint = toText(shape.hint);

  const meta = [
    code ? `code: ${code}` : null,
    details ? `details: ${details}` : null,
    hint ? `hint: ${hint}` : null,
  ].filter(Boolean);

  return meta.length > 0 ? `${message} (${meta.join(' | ')})` : message;
}
