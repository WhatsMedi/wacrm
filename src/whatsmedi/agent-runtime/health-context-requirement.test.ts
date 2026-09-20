import { describe, expect, it } from 'vitest'
import { capabilityRequiresHealthContext } from './health-context-requirement'

describe('capabilityRequiresHealthContext', () => {
  it.each([
    'health_context.read',
    'health_information.explain',
    'health_assessment.run',
    'appointment.create',
    'diagnostic.order',
    'pharmacy.order',
    'follow_up.schedule',
  ] as const)('requires health context for %s', (capability) => {
    expect(capabilityRequiresHealthContext(capability)).toBe(true)
  })

  it.each([
    'provider.search',
    'human.handoff',
  ] as const)('does not require health context for %s', (capability) => {
    expect(capabilityRequiresHealthContext(capability)).toBe(false)
  })
})
