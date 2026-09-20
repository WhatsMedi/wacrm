import { describe, expect, it } from 'vitest'
import type { PersonId } from '../identity/types'
import type { HealthcareActionRequest } from './types'
import { HealthcareActionPolicy } from './policy'

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
  payload: {},
  ...overrides,
})

describe('HealthcareActionPolicy', () => {
  const policy = new HealthcareActionPolicy()

  it('allows a patient to request a permitted healthcare action', () => {
    expect(policy.check(makeRequest())).toEqual({
      allowed: true,
      reason: null,
    })
  })

  it('allows caregiver actions through the policy seam', () => {
    expect(
      policy.check(
        makeRequest({
          actorType: 'caregiver',
          actorId: 'caregiver-1',
        }),
      ),
    ).toEqual({
      allowed: true,
      reason: null,
    })
  })

  it('allows agent actions through the policy seam', () => {
    expect(
      policy.check(
        makeRequest({
          actorType: 'agent',
          actorId: 'agent-1',
          actionType: 'diagnostic.order',
        }),
      ),
    ).toEqual({
      allowed: true,
      reason: null,
    })
  })

  it('allows provider actions through the policy seam', () => {
    expect(
      policy.check(
        makeRequest({
          actorType: 'provider',
          actorId: 'provider-1',
          actionType: 'diagnostic.order',
        }),
      ),
    ).toEqual({
      allowed: true,
      reason: null,
    })
  })

  it('allows system actions through the policy seam', () => {
    expect(
      policy.check(
        makeRequest({
          actorType: 'system',
          actorId: null,
          actionType: 'follow_up.schedule',
        }),
      ),
    ).toEqual({
      allowed: true,
      reason: null,
    })
  })
})
