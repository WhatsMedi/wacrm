import { describe, expect, it, vi } from 'vitest'
import type { PersonId } from '../identity/types'
import { HealthContextAuthorizationPolicy } from './authorization-policy'
import { HealthContextAccessPolicy } from './access-policy'
import { HealthContextAccessError, HealthContextService } from './service'
import type { HealthContextRepository } from './repository'

describe('HealthContextService', () => {
  const accountId = 'account-1'
  const personId = 'person-1' as PersonId

  function createRepository() {
    return {
      getAuthorization: vi.fn(async () => null),
      getPersonAccountMembership: vi.fn(
        async (): Promise<'active' | 'inactive' | null> => 'active',
      ),
      getHealthContextItems: vi.fn(async () => []),
    } satisfies HealthContextRepository
  }

  function createAuthorizationPolicy(
    authorized = true,
  ) {
    return {
      isAuthorized: vi.fn(async () => authorized),
    } as unknown as HealthContextAuthorizationPolicy
  }

  function createService(
    repository: ReturnType<typeof createRepository>,
    authorized = true,
  ) {
    return new HealthContextService(
      repository,
      new HealthContextAccessPolicy(),
      createAuthorizationPolicy(authorized),
    )
  }

  it('returns scoped health context for an authorized request', async () => {
    const repository = createRepository()
    const authorizationPolicy = createAuthorizationPolicy(true)

    const service = new HealthContextService(
      repository,
      new HealthContextAccessPolicy(),
      authorizationPolicy,
    )

    const result = await service.getContext({
      accountId,
      personId,
      purpose: 'clinical_conversation',
      actorType: 'patient',
      actorId: personId,
    })

    expect(result.accountId).toBe(accountId)
    expect(result.personId).toBe(personId)
    expect(result.purpose).toBe('clinical_conversation')

    expect(authorizationPolicy.isAuthorized).toHaveBeenCalledWith({
      accountId,
      personId,
      actorType: 'patient',
      actorId: personId,
      purpose: 'clinical_conversation',
    })

    expect(repository.getHealthContextItems).toHaveBeenCalledTimes(1)
  })

  it('rejects a person who is not a member of the account', async () => {
    const repository = createRepository()

    repository.getPersonAccountMembership.mockResolvedValue(null)

    const service = createService(repository)

    await expect(
      service.getContext({
        accountId,
        personId,
        purpose: 'clinical_conversation',
        actorType: 'patient',
        actorId: personId,
      }),
    ).rejects.toThrow(
      'Person is not a member of the requested account.',
    )

    expect(repository.getHealthContextItems).not.toHaveBeenCalled()
  })

  it('rejects inactive person-account membership', async () => {
    const repository = createRepository()

    repository.getPersonAccountMembership.mockResolvedValue(
      'inactive',
    )

    const service = createService(repository)

    await expect(
      service.getContext({
        accountId,
        personId,
        purpose: 'clinical_conversation',
        actorType: 'patient',
        actorId: personId,
      }),
    ).rejects.toThrow(
      'Person account membership is not active.',
    )

    expect(repository.getHealthContextItems).not.toHaveBeenCalled()
  })

  it('rejects an unauthorized actor before reading health data', async () => {
    const repository = createRepository()
    const authorizationPolicy = createAuthorizationPolicy(false)

    const service = new HealthContextService(
      repository,
      new HealthContextAccessPolicy(),
      authorizationPolicy,
    )

    await expect(
      service.getContext({
        accountId,
        personId,
        purpose: 'clinical_conversation',
        actorType: 'caregiver',
        actorId: 'caregiver-1',
      }),
    ).rejects.toThrow(
      'Actor is not authorized to access this person health context for the requested purpose.',
    )

    expect(authorizationPolicy.isAuthorized).toHaveBeenCalledWith({
      accountId,
      personId,
      actorType: 'caregiver',
      actorId: 'caregiver-1',
      purpose: 'clinical_conversation',
    })

    expect(repository.getHealthContextItems).not.toHaveBeenCalled()
  })

  it('denies health-context access when the requested account does not own the person', async () => {
    const requestedAccountId = 'account-2'

    const repository = {
      getPersonAccountMembership: vi.fn().mockResolvedValue(null),
      getHealthContextItems: vi.fn(),
    }

    const authorizationPolicy = {
      isAuthorized: vi.fn().mockResolvedValue(true),
    }

    const service = new HealthContextService(
      repository as never,
      new HealthContextAccessPolicy(),
      authorizationPolicy as never,
    )

    await expect(
      service.getContext({
        accountId: requestedAccountId,
        personId,
        purpose: 'clinical_conversation',
        actorType: 'patient',
        actorId: personId,
      }),
    ).rejects.toThrow()

    expect(
      repository.getPersonAccountMembership,
    ).toHaveBeenCalledWith(requestedAccountId, personId)

    expect(repository.getHealthContextItems).not.toHaveBeenCalled()
  })})
