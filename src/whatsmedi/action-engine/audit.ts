import type {
  HealthcareActionResult,
  HealthcareActionStatus,
  HealthcareActionType,
} from './types'

export interface HealthcareActionAuditEvent {
  accountId: string
  personId: string
  actorType: string
  actorId: string | null
  actionType: HealthcareActionType
  status: HealthcareActionStatus
  correlationId: string
  idempotencyKey: string
  message: string | null
  referenceId: string | null
  occurredAt: string
}

export interface HealthcareActionAuditSink {
  record(event: HealthcareActionAuditEvent): Promise<void>
}

export class InMemoryHealthcareActionAuditSink
  implements HealthcareActionAuditSink
{
  private readonly events: HealthcareActionAuditEvent[] = []

  async record(event: HealthcareActionAuditEvent): Promise<void> {
    this.events.push(event)
  }

  getEvents(): readonly HealthcareActionAuditEvent[] {
    return [...this.events]
  }
}

export const toActionAuditEvent = (
  result: HealthcareActionResult,
  occurredAt: string,
): HealthcareActionAuditEvent => ({
  accountId: result.action.accountId,
  personId: result.action.personId,
  actorType: result.action.actorType,
  actorId: result.action.actorId,
  actionType: result.action.actionType,
  status: result.action.status,
  correlationId: result.action.correlationId,
  idempotencyKey: result.action.idempotencyKey,
  message: result.message,
  referenceId: result.referenceId,
  occurredAt,
})
