import { describe, expect, it, vi } from 'vitest'
import { createWhatsMediId } from '../types'
import type { AgentDefinition } from './types'
import { InMemoryToolRegistry } from './tool-registry'
import { ToolExecutor } from './tool-executor'
import { getHealthContextTool } from './reference-tool'
import type { ToolDefinition } from './tool'

const agent: AgentDefinition = {
  id: 'health-information',
  name: 'Health Information Agent',
  description: 'Reference healthcare information agent',
  version: '1.0.0',
  capabilities: [
    'health_context.read',
    'health_information.explain',
  ],
  allowedPurposes: ['clinical_conversation'],
  enabled: true,
}

const baseContext = {
  accountId: 'account-1',
  personId: createWhatsMediId('person-1'),
  actorType: 'patient' as const,
  actorId: 'person-1',
  purpose: 'clinical_conversation' as const,
  correlationId: 'correlation-1',
  agent,
  healthContext: {
    personId: createWhatsMediId('person-1'),
  } as never,
  requestMessage: 'Explain my health information',
}

describe('Controlled Tool Runtime', () => {
  it('registers and resolves a tool', () => {
    const registry = new InMemoryToolRegistry()

    registry.register(getHealthContextTool)

    expect(registry.get('get_health_context')).toBe(
      getHealthContextTool,
    )
    expect(registry.list()).toHaveLength(1)
  })

  it('rejects duplicate tool registration', () => {
    const registry = new InMemoryToolRegistry()

    registry.register(getHealthContextTool)

    expect(() =>
      registry.register(getHealthContextTool),
    ).toThrow('Tool already registered')
  })

  it('executes a permitted tool', async () => {
    const registry = new InMemoryToolRegistry()
    registry.register(getHealthContextTool)

    const executor = new ToolExecutor(
      registry,
      vi
        .fn()
        .mockReturnValueOnce('2026-01-01T00:00:00.000Z')
        .mockReturnValueOnce('2026-01-01T00:00:01.000Z'),
    )

    const result = await executor.execute(
      'get_health_context',
      {},
      baseContext,
    )

    expect(result.status).toBe('completed')
    expect(result.output).toEqual(baseContext.healthContext)
    expect(result.audit.correlationId).toBe(
      'correlation-1',
    )
    expect(result.audit.accountId).toBe('account-1')
    expect(result.audit.toolName).toBe(
      'get_health_context',
    )
  })

  it('denies a tool when the agent lacks its required capability', async () => {
    const registry = new InMemoryToolRegistry()

    const restrictedTool: ToolDefinition<
      Record<string, never>,
      string
    > = {
      name: 'restricted_tool',
      description: 'Restricted reference tool',
      permission: {
        requiredCapabilities: ['appointment.create'],
      },
      async execute() {
        throw new Error(
          'This tool must never execute in this test',
        )
      },
    }

    registry.register(restrictedTool)

    const executor = new ToolExecutor(
      registry,
      () => '2026-01-01T00:00:00.000Z',
    )

    const result = await executor.execute(
      'restricted_tool',
      {},
      baseContext,
    )

    expect(result.status).toBe('blocked')
    expect(result.message).toContain(
      'appointment.create',
    )
  })

  it('denies an unknown tool without executing anything', async () => {
    const registry = new InMemoryToolRegistry()
    const executor = new ToolExecutor(
      registry,
      () => '2026-01-01T00:00:00.000Z',
    )

    const result = await executor.execute(
      'does_not_exist',
      {},
      baseContext,
    )

    expect(result.status).toBe('blocked')
    expect(result.output).toBeNull()
  })

  it('does not allow the reference tool to bypass the health-context boundary', async () => {
    const registry = new InMemoryToolRegistry()
    registry.register(getHealthContextTool)

    const executor = new ToolExecutor(
      registry,
      () => '2026-01-01T00:00:00.000Z',
    )

    const result = await executor.execute(
      'get_health_context',
      {},
      {
        ...baseContext,
        healthContext: null,
      },
    )

    expect(result.status).toBe('failed')
    expect(result.output).toBeNull()
    expect(result.message).toContain(
      'Health context is unavailable',
    )
  })

  it('contains account and person boundaries in tool audit metadata', async () => {
    const registry = new InMemoryToolRegistry()
    registry.register(getHealthContextTool)

    const executor = new ToolExecutor(
      registry,
      () => '2026-01-01T00:00:00.000Z',
    )

    const result = await executor.execute(
      'get_health_context',
      {},
      baseContext,
    )

    expect(result.audit.accountId).toBe('account-1')
    expect(result.audit.personId).toBe(
      baseContext.personId,
    )
    expect(result.audit.agentId).toBe(
      'health-information',
    )
  })
})
