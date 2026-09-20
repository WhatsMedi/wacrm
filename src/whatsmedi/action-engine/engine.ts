import type {
  HealthcareActionRequest,
  HealthcareActionResult,
} from './types'
import type { HealthcareActionRegistry } from './registry'
import { HealthcareActionPolicy } from './policy'
import type { HealthcareActionIdempotencyStore } from './idempotency'
import {
  toActionAuditEvent,
  type HealthcareActionAuditSink,
} from './audit'

export class HealthcareActionEngine {
  constructor(
    private readonly registry: HealthcareActionRegistry,
    private readonly policy: HealthcareActionPolicy,
    private readonly idempotencyStore: HealthcareActionIdempotencyStore,
    private readonly auditSink: HealthcareActionAuditSink,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async execute(
    request: HealthcareActionRequest,
  ): Promise<HealthcareActionResult> {
    const existingResult = await this.idempotencyStore.get(
      request.accountId,
      request.idempotencyKey,
    )

    if (existingResult) {
      await this.recordAudit(existingResult)
      return existingResult
    }

    const policyDecision = this.policy.check(request)

    if (!policyDecision.allowed) {
      const result = this.buildResult(
        request,
        'blocked',
        policyDecision.reason,
        null,
      )

      await this.idempotencyStore.set(
        request.accountId,
        request.idempotencyKey,
        result,
      )

      await this.recordAudit(result)

      return result
    }

    const executor = this.registry.get(request.actionType)

    if (!executor) {
      const result = this.buildResult(
        request,
        'failed',
        'No executor registered for this action',
        null,
      )

      await this.idempotencyStore.set(
        request.accountId,
        request.idempotencyKey,
        result,
      )

      await this.recordAudit(result)

      return result
    }

    const result = await executor.execute(request)

    await this.idempotencyStore.set(
      request.accountId,
      request.idempotencyKey,
      result,
    )

    await this.recordAudit(result)

    return result
  }

  private async recordAudit(
    result: HealthcareActionResult,
  ): Promise<void> {
    try {
      await this.auditSink.record(
        toActionAuditEvent(result, this.now()),
      )
    } catch {
      // Audit failure must not change the healthcare action result.
      // Production durability/retry will be handled by the audit sink.
    }
  }

  private buildResult(
    request: HealthcareActionRequest,
    status: 'blocked' | 'failed',
    message: string | null,
    referenceId: string | null,
  ): HealthcareActionResult {
    const now = this.now()

    return {
      action: {
        id: '',
        accountId: request.accountId,
        personId: request.personId,
        actorType: request.actorType,
        actorId: request.actorId,
        actionType: request.actionType,
        status,
        correlationId: request.correlationId,
        idempotencyKey: request.idempotencyKey,
        payload: request.payload,
        createdAt: now,
        updatedAt: now,
      },
      message,
      referenceId,
    }
  }
}
