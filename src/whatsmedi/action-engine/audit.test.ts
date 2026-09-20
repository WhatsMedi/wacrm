import { describe, expect, it } from 'vitest'
import type { HealthcareActionResult } from './types'
import {
  InMemoryHealthcareActionAuditSink,
  toActionAuditEvent,
} from './audit'

const makeResult = (): HealthcareActionResult => ({
  action: {
    id: 'action-1',
    accountId: 'account-1',
    personId: 'person-1' as HealthcareActionResult['action']['personId'],
    actorType: 'patient',
    actorId: 'person-1',
    actionType: 'appointment.create',
    status: 'completed',
    correlationId: 'correlation-1',
    idempotencyKey: 'idempotency-1',
    payload: {
      providerId: 'provider-1',
    },
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:01.000Z',
  },
  message: 'Appointment created',
  referenceId: 'appointment-1',
})

describe('HealthcareActionAuditSink', () => {
  it('records an action audit event', async () => {
    const sink = new InMemoryHealthcareActionAuditSink()

    const event = toActionAuditEvent(
      makeResult(),
      '2026-09-20T10:00:02.000Z',
    )

    await sink.record(event)

    expect(sink.getEvents()).toEqual([event])
  })

  it('returns a copy of recorded events', async () => {
    const sink = new InMemoryHealthcareActionAuditSink()

    const event = toActionAuditEvent(
      makeResult(),
      '2026-09-20T10:00:02.000Z',
    )

    await sink.record(event)

    const events = sink.getEvents()

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(event)
  })

  it('preserves the healthcare action trace identifiers', () => {
    const event = toActionAuditEvent(
      makeResult(),
      '2026-09-20T10:00:02.000Z',
    )

    expect(event.accountId).toBe('account-1')
    expect(event.personId).toBe('person-1')
    expect(event.correlationId).toBe('correlation-1')
    expect(event.idempotencyKey).toBe('idempotency-1')
    expect(event.referenceId).toBe('appointment-1')
  })

  it('preserves blocked and failed statuses', () => {
    const result = makeResult()

    const blockedEvent = toActionAuditEvent(
      {
        ...result,
        action: {
          ...result.action,
          status: 'blocked',
        },
      },
      '2026-09-20T10:00:02.000Z',
    )

    const failedEvent = toActionAuditEvent(
      {
        ...result,
        action: {
          ...result.action,
          status: 'failed',
        },
      },
      '2026-09-20T10:00:03.000Z',
    )

    expect(blockedEvent.status).toBe('blocked')
    expect(failedEvent.status).toBe('failed')
  })
})
