import { randomUUID } from 'node:crypto';

type ExternalFailure = { code?: unknown; name?: unknown; status?: unknown } | null | undefined;

function diagnosticMeta(cause: unknown) {
  if (!cause || typeof cause !== 'object') return { kind: typeof cause };
  const value = cause as ExternalFailure;
  return {
    externalCode: typeof value?.code === 'string' ? value.code : undefined,
    name: typeof value?.name === 'string' ? value.name : undefined,
    status: typeof value?.status === 'number' ? value.status : undefined
  };
}

/**
 * Registers a failure without copying database/provider messages into UI responses.
 * The returned id is safe to show to a user and can be correlated with server logs.
 */
export function reportServerFailure(code: string, cause?: unknown): string {
  const errorId = randomUUID();
  console.error(`[${errorId}] ${code}`, diagnosticMeta(cause));
  return errorId;
}

export function apiFailure(message: string, code: string, cause?: unknown) {
  return { error: message, error_code: code, error_id: reportServerFailure(code, cause) };
}

export function failAction(code: string, cause?: unknown): never {
  const errorId = reportServerFailure(code, cause);
  throw new Error(`${code} · Error ID: ${errorId}`);
}
