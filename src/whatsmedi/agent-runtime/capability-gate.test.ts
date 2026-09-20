import { describe, expect, it } from 'vitest'
import type { AgentDefinition } from './types'
import { AgentCapabilityGate } from './capability-gate'

const makeAgent = (
  overrides: Partial<AgentDefinition> = {},
): AgentDefinition => ({
  id: 'test-agent',
  name: 'Test Agent',
  description: 'Test agent',
  version: '1.0.0',
  capabilities: [
    'health_context.read',
    'health_information.explain',
  ],
  allowedPurposes: ['clinical_conversation'],
  enabled: true,
  ...overrides,
})

describe('AgentCapabilityGate', () => {
  it('allows a declared capability', () => {
    const gate = new AgentCapabilityGate()

    expect(
      gate.check(makeAgent(), 'health_context.read'),
    ).toEqual({
      allowed: true,
      reason: null,
    })
  })

  it('blocks an undeclared capability', () => {
    const gate = new AgentCapabilityGate()

    expect(
      gate.check(makeAgent(), 'appointment.create'),
    ).toEqual({
      allowed: false,
      reason: 'Agent does not have this capability',
    })
  })

  it('blocks all capabilities for a disabled agent', () => {
    const gate = new AgentCapabilityGate()

    expect(
      gate.check(
        makeAgent({ enabled: false }),
        'health_context.read',
      ),
    ).toEqual({
      allowed: false,
      reason: 'Agent is disabled',
    })
  })

  it('allows another declared capability', () => {
    const gate = new AgentCapabilityGate()

    expect(
      gate.check(
        makeAgent(),
        'health_information.explain',
      ),
    ).toEqual({
      allowed: true,
      reason: null,
    })
  })
})
