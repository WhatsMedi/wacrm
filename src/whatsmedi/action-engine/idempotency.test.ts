import { describe, expect, it } from 'vitest'
import type {
  HealthcareAction,
  HealthcareActionResult,
} from './types'
import {
  InMemoryHealthcareActionIdempotencyStore,
} from './idempotency'

const makeResult = (
  accountId = 'account-1',
  idempotencyKey = 'idem-1',
): HealthcareActionResult => {
  const action: HealthcareAction = {
    id: 'action-1',
    accountId,
    personId: 'person-1' as HealthcareAction['personId'],
    actorType: 'patient',
    actorId: 'person-1',
    actionType: 'appointment.create',
    status: 'completed',
    correlationId: 'correlation-1',
    idempotencyKey,
    payload: {},
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:01.000Z',
  }

  return {
    action,
    message: 'Appointment created',
    referenceId: 'appointment-1',
  }
}

describe('HealthcareActionIdempotencyStore', () => {
  it('returns null when no result exists', async () => {
    const store = new InMemoryHealthcareActionIdempotencyStore()

    await expect(
      store.get('account-1', 'idem-1'),
    ).resolves.toBeNull()
  })

  it('stores and retrieves an action result', async () => {
    const store = new InMemoryHealthcareActionIdempotencyStore()
    const result = makeResult()

    await store.set('account-1', 'idem-1', result)

    await expect(
      store.get('account-1', 'idem-1'),
    ).resolves.toEqual(result)
  })

  it('isolates idempotency keys between accounts', async () => {
    const store = new InMemoryHealthcareActionIdempotencyStore()
    const result = makeResult('account-1', 'idem-1')

    await store.set('account-1', 'idem-1', result)

    await expect(
      store.get('account-2', 'idem-1'),
    ).resolves.toBeNull()
  })

  it('returns the stored result for repeated requests', async () => {
    const store = new InMemoryHealthcareActionIdempotencyStore()
    const firstResult = makeResult()

    await store.set('account-1', 'idem-1', firstResult)

    const secondLookup = await store.get(
      'account-1',
      'idem-1',
    )

    expect(secondLookup).toEqual(firstResult)
  })
})
