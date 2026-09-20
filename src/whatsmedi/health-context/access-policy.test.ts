import { describe, expect, it } from 'vitest'
import { HealthContextAccessPolicy } from './access-policy'

const baseRequest = {
  accountId: 'account-1',
  personId: 'person-1',
  actorType: 'agent' as const,
  actorId: 'agent-1',
}

describe('HealthContextAccessPolicy', () => {
  const policy = new HealthContextAccessPolicy()

  it('limits medication actions to medication-relevant context', () => {
    const scope = policy.getScope({
      ...baseRequest,
      purpose: 'medication_action',
    })

    expect(scope.allowedDomains).toEqual([
      'condition',
      'medication',
      'allergy',
      'observation',
    ])
  })

  it('limits diagnostic actions to diagnostic-relevant context', () => {
    const scope = policy.getScope({
      ...baseRequest,
      purpose: 'diagnostic_action',
    })

    expect(scope.allowedDomains).toEqual([
      'condition',
      'observation',
      'document',
      'encounter',
    ])
  })

  it('allows care coordination to use the broader care context', () => {
    const scope = policy.getScope({
      ...baseRequest,
      purpose: 'care_coordination',
    })

    expect(scope.allowedDomains).toHaveLength(8)
  })

  it('checks whether a domain is allowed', () => {
    const request = {
      ...baseRequest,
      purpose: 'appointment_booking' as const,
    }

    expect(policy.isDomainAllowed(request, 'encounter')).toBe(true)
    expect(policy.isDomainAllowed(request, 'medication')).toBe(false)
  })
})
