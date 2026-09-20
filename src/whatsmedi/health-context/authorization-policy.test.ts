import { describe, expect, it, vi } from 'vitest'
import type { PersonId } from '../identity/types'
import { HealthContextAuthorizationPolicy } from './authorization-policy'
import type {
  HealthContextAuthorization,
  HealthContextAuthorizationRepository,
} from './authorization'

describe('HealthContextAuthorizationPolicy', () => {
  const accountId = 'account-1'
  const personId = 'person-1' as PersonId

  function createRepository() {
    return {
      getAuthorization: vi.fn<
        (
          accountId: string,
          personId: PersonId,
          actorType: Parameters<
            HealthContextAuthorizationRepository['getAuthorization']
          >[2],
          actorId: string,
          purpose: Parameters<
            HealthContextAuthorizationRepository['getAuthorization']
          >[4],
        ) => Promise<HealthContextAuthorization | null>
      >(async () => null),
    } satisfies HealthContextAuthorizationRepository
  }

  it('allows patient self-access when actorId matches personId', async () => {
    const repository = createRepository()
    const policy = new HealthContextAuthorizationPolicy(repository)

    const result = await policy.isAuthorized({
      accountId,
      personId,
      actorType: 'patient',
      actorId: personId,
      purpose: 'clinical_conversation',
    })

    expect(result).toBe(true)
    expect(repository.getAuthorization).not.toHaveBeenCalled()
  })

  it('denies patient access when actorId does not match personId', async () => {
    const repository = createRepository()
    const policy = new HealthContextAuthorizationPolicy(repository)

    const result = await policy.isAuthorized({
      accountId,
      personId,
      actorType: 'patient',
      actorId: 'different-person',
      purpose: 'clinical_conversation',
    })

    expect(result).toBe(false)
    expect(repository.getAuthorization).not.toHaveBeenCalled()
  })

  it('allows a caregiver with an active authorization', async () => {
    const repository = createRepository()

    repository.getAuthorization.mockResolvedValue({
      accountId,
      personId,
      actorType: 'caregiver',
      actorId: 'caregiver-1',
      purpose: 'clinical_conversation',
      relationship: 'family',
      status: 'active',
      expiresAt: null,
    })

    const policy = new HealthContextAuthorizationPolicy(repository)

    const result = await policy.isAuthorized({
      accountId,
      personId,
      actorType: 'caregiver',
      actorId: 'caregiver-1',
      purpose: 'clinical_conversation',
    })

    expect(result).toBe(true)
  })

  it('denies a caregiver without an authorization', async () => {
    const repository = createRepository()
    const policy = new HealthContextAuthorizationPolicy(repository)

    const result = await policy.isAuthorized({
      accountId,
      personId,
      actorType: 'caregiver',
      actorId: 'caregiver-1',
      purpose: 'clinical_conversation',
    })

    expect(result).toBe(false)
  })

  it('denies a revoked authorization', async () => {
    const repository = createRepository()

    repository.getAuthorization.mockResolvedValue({
      accountId,
      personId,
      actorType: 'provider',
      actorId: 'provider-1',
      purpose: 'clinical_conversation',
      relationship: 'provider',
      status: 'revoked',
      expiresAt: null,
    })

    const policy = new HealthContextAuthorizationPolicy(repository)

    const result = await policy.isAuthorized({
      accountId,
      personId,
      actorType: 'provider',
      actorId: 'provider-1',
      purpose: 'clinical_conversation',
    })

    expect(result).toBe(false)
  })

  it('denies an expired authorization', async () => {
    const repository = createRepository()

    repository.getAuthorization.mockResolvedValue({
      accountId,
      personId,
      actorType: 'provider',
      actorId: 'provider-1',
      purpose: 'clinical_conversation',
      relationship: 'provider',
      status: 'active',
      expiresAt: '2020-01-01T00:00:00.000Z',
    })

    const policy = new HealthContextAuthorizationPolicy(repository)

    const result = await policy.isAuthorized({
      accountId,
      personId,
      actorType: 'provider',
      actorId: 'provider-1',
      purpose: 'clinical_conversation',
    })

    expect(result).toBe(false)
  })

  it('denies requests without an actorId', async () => {
    const repository = createRepository()
    const policy = new HealthContextAuthorizationPolicy(repository)

    const result = await policy.isAuthorized({
      accountId,
      personId,
      actorType: 'caregiver',
      actorId: null,
      purpose: 'clinical_conversation',
    })

    expect(result).toBe(false)
    expect(repository.getAuthorization).not.toHaveBeenCalled()
  })

  it('requires authorization for the requested purpose', async () => {
    const repository = createRepository()

    repository.getAuthorization.mockImplementation(
      async (
        _accountId,
        _personId,
        _actorType,
        _actorId,
        purpose,
      ) => {
        if (purpose !== 'clinical_conversation') {
          return null
        }

        return {
          accountId,
          personId,
          actorType: 'provider',
          actorId: 'provider-1',
          purpose: 'clinical_conversation',
          relationship: 'provider',
          status: 'active',
          expiresAt: null,
        }
      },
    )

    const policy = new HealthContextAuthorizationPolicy(repository)

    const result = await policy.isAuthorized({
      accountId,
      personId,
      actorType: 'provider',
      actorId: 'provider-1',
      purpose: 'medication_action',
    })

    expect(result).toBe(false)

    expect(repository.getAuthorization).toHaveBeenCalledWith(
      accountId,
      personId,
      'provider',
      'provider-1',
      'medication_action',
    )
  })
})
