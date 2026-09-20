import { describe, expect, it, vi } from 'vitest'
import type { PersonId } from '../identity/types'
import type { HealthContextRepository } from './repository'
import {
  HealthContextAccessError,
  HealthContextService,
} from './service'

const personId = 'person-1' as PersonId

function createRepository(
  membership: 'active' | 'inactive' | null,
) {
  return {
    getPersonAccountMembership: vi.fn(async () => membership),

    getHealthContextItems: vi.fn(async (
      _accountId: string,
      _personId: PersonId,
      _purpose: Parameters<
        HealthContextRepository['getHealthContextItems']
      >[2],
      _actorType: Parameters<
        HealthContextRepository['getHealthContextItems']
      >[3],
      _allowedDomains: Parameters<
        HealthContextRepository['getHealthContextItems']
      >[4],
    ) => [
      {
        domain: 'condition' as const,
        id: 'condition-1',
        displayText: 'Diabetes',
        verificationStatus: 'verified' as const,
        source: 'provider_entered' as const,
        sourceReference: 'provider-1',
        recordedAt: '2026-09-19T00:00:00.000Z',
        effectiveAt: null,
      },
    ]),
  } satisfies HealthContextRepository
}

describe('HealthContextService', () => {
  it('returns health context for an active person-account membership', async () => {
    const repository = createRepository('active')
    const service = new HealthContextService(repository)

    const result = await service.getContext({
      accountId: 'account-1',
      personId,
      purpose: 'clinical_conversation',
      actorType: 'agent',
      actorId: 'agent-1',
    })

    expect(result.accountId).toBe('account-1')
    expect(result.personId).toBe(personId)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].displayText).toBe('Diabetes')

    expect(repository.getHealthContextItems).toHaveBeenCalledWith(
      'account-1',
      personId,
      'clinical_conversation',
      'agent',
      [
        'condition',
        'medication',
        'allergy',
        'observation',
        'encounter',
        'document',
        'event',
      ],
    )
  })

  it('rejects a person who is not a member of the account', async () => {
    const repository = createRepository(null)
    const service = new HealthContextService(repository)

    await expect(
      service.getContext({
        accountId: 'account-1',
        personId,
        purpose: 'clinical_conversation',
        actorType: 'agent',
        actorId: 'agent-1',
      }),
    ).rejects.toThrow(HealthContextAccessError)

    expect(repository.getHealthContextItems).not.toHaveBeenCalled()
  })

  it('rejects inactive person-account membership', async () => {
    const repository = createRepository('inactive')
    const service = new HealthContextService(repository)

    await expect(
      service.getContext({
        accountId: 'account-1',
        personId,
        purpose: 'clinical_conversation',
        actorType: 'agent',
        actorId: 'agent-1',
      }),
    ).rejects.toThrow(HealthContextAccessError)

    expect(repository.getHealthContextItems).not.toHaveBeenCalled()
  })
})
