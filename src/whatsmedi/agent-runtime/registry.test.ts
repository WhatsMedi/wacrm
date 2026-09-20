import { describe, expect, it } from 'vitest'
import type { AgentDefinition } from './types'
import { InMemoryAgentRegistry } from './registry'

const makeAgent = (
  overrides: Partial<AgentDefinition> = {},
): AgentDefinition => ({
  id: 'test-agent',
  name: 'Test Agent',
  description: 'Test agent',
  version: '1.0.0',
  capabilities: ['health_context.read'],
  allowedPurposes: ['clinical_conversation'],
  enabled: true,
  ...overrides,
})

describe('InMemoryAgentRegistry', () => {
  it('registers and resolves an agent', () => {
    const registry = new InMemoryAgentRegistry()
    const agent = makeAgent()

    registry.register(agent)

    expect(registry.get(agent.id)).toEqual(agent)
  })

  it('returns null for an unknown agent', () => {
    const registry = new InMemoryAgentRegistry()

    expect(registry.get('missing-agent')).toBeNull()
  })

  it('lists only enabled agents', () => {
    const registry = new InMemoryAgentRegistry()

    registry.register(makeAgent({ id: 'enabled-agent', enabled: true }))
    registry.register(makeAgent({ id: 'disabled-agent', enabled: false }))

    expect(registry.listEnabled()).toEqual([
      expect.objectContaining({ id: 'enabled-agent' }),
    ])
  })

  it('replaces an existing agent with the same id', () => {
    const registry = new InMemoryAgentRegistry()

    registry.register(makeAgent({ id: 'same-agent', version: '1.0.0' }))
    registry.register(makeAgent({ id: 'same-agent', version: '2.0.0' }))

    expect(registry.get('same-agent')?.version).toBe('2.0.0')
  })
})
