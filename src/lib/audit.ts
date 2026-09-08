import { db } from '@/lib/db';

/// The single, persistent way to record an auditable event. Every important
/// operation in Verifin (upload, each AI stage, Hermes tool call, retry,
/// comment, status change, human decision) must go through this — see
/// CLAUDE.md section 22.
export async function recordAuditEvent(
  applicationId: string,
  actor: string,
  action: string,
  details?: string
) {
  return db.auditEntry.create({
    data: { applicationId, actor, action, details },
  });
}
