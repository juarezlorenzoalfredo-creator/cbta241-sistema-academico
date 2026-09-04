import { randomUUID } from 'node:crypto';

type SecurityEvent = 'LOGIN_FAILED' | 'SESSION_AUDIT_WRITE_FAILED';

export function logSecurityEvent(event: SecurityEvent, metadata: Record<string, string | number | boolean | null> = {}) {
  const errorId = randomUUID();
  console.error(JSON.stringify({
    level: 'warn',
    event,
    errorId,
    occurredAt: new Date().toISOString(),
    ...metadata
  }));
  return errorId;
}
