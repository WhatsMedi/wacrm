import { describe, expect, it } from 'vitest'
import type { PersonId } from '../identity/types'
import type { HealthcareActionRequest } from './types'
import {
  InMemoryHealthcareActionRegistry,
  type HealthcareActionExecutor,
} from './registry'
import { HealthcareActionPolicy } from './policy'
import {
  InMemoryHealthcareActionIdempotencyStore,
} from './idempotency'
import {
  InMemoryHealthcareActionAuditSink,
  type HealthcareActionAuditSink,
} from './audit'
import { HealthcareActionEngine } from './engine'

const makeRequest = (
  overrides: Partial<HealthcareActionRequest> = {},
): HealthcareActionRequest => ({
  accountId: 'account-1',
  personId: 'person-1' as PersonId,
  actorType: 'patient',
  actorId: 'person-1',
  actionType: 'appointment.create',
  correlationId: 'correlation-1',
  idempotencyKey: 'idempotency-1',
  payload: {
    providerId: 'provider-1',
  },
  ...overrides,
})

const makeExecutor = (
  actionType: HealthcareActionExecutor['actionType'],
  resultMessage = 'Action executed',
  onExecute?: () => void,
): HealthcareActionExecutor => ({
  actionType,
  async execute(request) {
    onExecute?.()

    return {
      action: {
        id: 'action-1',
        accountId: request.accountId,
        personId: request.personId,
        actorType: request.actorType,
        actorId: request.actorId,
        actionType: request.actionType,
        status: 'completed',
        correlationId: request.correlationId,
        idempotencyKey: request.idempotencyKey,
        payload: request.payload,
        createdAt: '2026-09-20T10:00:00.000Z',
        updatedAt: '2026-09-20T10:00:01.000Z',
      },
      message: resultMessage,
      referenceId: 'reference-1',
    }
  },
})

class DenyAllPolicy extends HealthcareActionPolicy {
  override check() {
    return {
      allowed: false,
      reason: 'Action denied by policy',
    }
  }
}

class FailingAuditSink implements HealthcareActionAuditSink {
  async record(): Promise<void> {
    throw new Error('Audit unavailable')
  }
}

const createEngine = (
  registry: InMemoryHealthcareActionRegistry,
  policy: HealthcareActionPolicy = new HealthcareActionPolicy(),
  auditSink: HealthcareActionAuditSink = new InMemoryHealthcareActionAuditSink(),
) =>
  new HealthcareActionEngine(
    registry,
    policy,
    new InMemoryHealthcareActionIdempotencyStore(),
    auditSink,
  )

describe('HealthcareActionEngine', () => {
  it('executes a registered action through its executor', async () => {
    const registry = new InMemoryHealthcareActionRegistry()

    registry.register(makeExecutor('appointment.create'))

    const engine = createEngine(registry)

    const result = await engine.execute(makeRequest())

    expect(result.action.status).toBe('completed')
    expect(result.action.actionType).toBe('appointment.create')
    expect(result.message).toBe('Action executed')
    expect(result.referenceId).toBe('reference-1')
  })

  it('blocks an action rejected by policy', async () => {
    const registry = new InMemoryHealthcareActionRegistry()

    registry.register(makeExecutor('appointment.create'))

    const engine = createEngine(
      registry,
      new DenyAllPolicy(),
    )

    const result = await engine.execute(makeRequest())

    expect(result.action.status).toBe('blocked')
    expect(result.message).toBe('Action denied by policy')
    expect(result.referenceId).toBeNull()
  })

  it('fails safely when no executor is registered', async () => {
    const registry = new InMemoryHealthcareActionRegistry()

    const engine = createEngine(registry)

    const result = await engine.execute(makeRequest())

    expect(result.action.status).toBe('failed')
    expect(result.message).toBe(
      'No executor registered for this action',
    )
  })

  it('preserves correlation and idempotency keys', async () => {
    const registry = new InMemoryHealthcareActionRegistry()

    registry.register(makeExecutor('appointment.create'))

    const engine = createEngine(registry)

    const result = await engine.execute(
      makeRequest({
        correlationId: 'corr-123',
        idempotencyKey: 'idem-123',
      }),
    )

    expect(result.action.correlationId).toBe('corr-123')
    expect(result.action.idempotencyKey).toBe('idem-123')
  })

  it('executes an idempotent request only once', async () => {
    const registry = new InMemoryHealthcareActionRegistry()
    let executionCount = 0

    registry.register(
      makeExecutor(
        'appointment.create',
        'Appointment created',
        () => {
          executionCount += 1
        },
      ),
    )

    const engine = createEngine(registry)
    const request = makeRequest({
      idempotencyKey: 'same-key',
    })

    const firstResult = await engine.execute(request)
    const secondResult = await engine.execute(request)

    expect(executionCount).toBe(1)
    expect(secondResult).toEqual(firstResult)
  })

  it('returns the action result even when audit recording fails', async () => {
    const registry = new InMemoryHealthcareActionRegistry()

    registry.register(makeExecutor('appointment.create'))

    const engine = createEngine(
      registry,
      new HealthcareActionPolicy(),
      new FailingAuditSink(),
    )

    const result = await engine.execute(makeRequest())

    expect(result.action.status).toBe('completed')
    expect(result.referenceId).toBe('reference-1')
  })
})
