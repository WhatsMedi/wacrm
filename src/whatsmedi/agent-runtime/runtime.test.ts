import { describe, expect, it } from 'vitest'
import type { AgentDefinition, AgentExecutionContext, AgentRequest } from './types'
import type { PersonId } from '../identity/types'
import { InMemoryAgentRegistry } from './registry'
import { AgentRuntime } from './runtime'
import { AgentCapabilityGate } from './capability-gate'
import { InMemoryAgentAuditSink } from './audit'

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

const makeRequest = (
  overrides: Partial<AgentRequest> = {},
): AgentRequest => ({
  accountId: 'account-1',
  personId: 'person-1' as PersonId,
  actorType: 'patient',
  actorId: 'person-1',
  purpose: 'clinical_conversation',
  message: 'Help me understand my health information.',
  agentId: 'test-agent',
  requestedCapability: 'health_context.read',
  correlationId: 'correlation-1',
  ...overrides,
})

const createRuntime = (agent?: AgentDefinition) => {
  const registry = new InMemoryAgentRegistry()

  if (agent) {
    registry.register(agent)
  }

  const auditSink = new InMemoryAgentAuditSink()

  const healthContextService = {
    getContext: async () => ({
      accountId: 'account-1',
      personId: 'person-1' as PersonId,
      generatedAt: '2026-09-20T13:00:00.000Z',
      purpose: 'clinical_conversation' as const,
      items: [],
    }),
  }

  let executionContext: AgentExecutionContext | null = null

  const executor = {
    execute: async (context: AgentExecutionContext) => {
      executionContext = context

      return {
        status: 'needs_input' as const,
        message: 'Agent execution boundary reached',
        correlationId: context.request.correlationId,
        agentId: context.agent.id,
        startedAt: context.startedAt,
        completedAt: '2026-09-20T13:00:01.000Z',
        actions: [],
      }
    },
  }

  let call = 0
  const timestamps = [
    '2026-09-20T13:00:00.000Z',
    '2026-09-20T13:00:01.000Z',
  ]

  const runtime = new AgentRuntime(
    registry,
    new AgentCapabilityGate(),
    auditSink,
    healthContextService,
    executor,
    () => timestamps[call++] ?? timestamps[timestamps.length - 1],
  )

  return { runtime, auditSink, getExecutionContext: () => executionContext }
}

describe('AgentRuntime', () => {
  it('reaches the execution boundary for an allowed request', async () => {
    const { runtime, auditSink, getExecutionContext } = createRuntime(makeAgent())

    const result = await runtime.execute(makeRequest())

    expect(getExecutionContext()?.healthContext).toMatchObject({
      accountId: 'account-1',
      personId: 'person-1',
      purpose: 'clinical_conversation',
    })
    expect(getExecutionContext()?.agent.id).toBe('test-agent')

    expect(result.status).toBe('needs_input')
    expect(result.agentId).toBe('test-agent')
    expect(result.correlationId).toBe('correlation-1')
    expect(result.actions).toEqual([])
    expect(result.startedAt).toBe('2026-09-20T13:00:00.000Z')
    expect(result.completedAt).toBe('2026-09-20T13:00:01.000Z')

    expect(auditSink.getEvents()).toHaveLength(1)
    expect(auditSink.getEvents()[0]).toMatchObject({
      status: 'needs_input',
      message: 'Agent execution boundary reached',
      metadata: {
        correlationId: 'correlation-1',
        agentId: 'test-agent',
        agentVersion: '1.0.0',
        actorType: 'patient',
        actorId: 'person-1',
        purpose: 'clinical_conversation',
      },
    })
  })

  it('fails when the agent does not exist and audits the failure', async () => {
    const { runtime, auditSink } = createRuntime()

    const result = await runtime.execute(makeRequest())

    expect(result.status).toBe('failed')
    expect(result.message).toBe('Agent not found')

    expect(auditSink.getEvents()).toHaveLength(1)
    expect(auditSink.getEvents()[0]).toMatchObject({
      status: 'failed',
      message: 'Agent not found',
      metadata: {
        agentId: 'test-agent',
        agentVersion: 'unknown',
      },
    })
  })

  it('blocks a disabled agent and audits the block', async () => {
    const { runtime, auditSink } = createRuntime(
      makeAgent({ enabled: false }),
    )

    const result = await runtime.execute(makeRequest())

    expect(result.status).toBe('blocked')
    expect(result.message).toBe('Agent is disabled')

    expect(auditSink.getEvents()).toHaveLength(1)
    expect(auditSink.getEvents()[0].status).toBe('blocked')
  })

  it('blocks a request for a disallowed purpose and audits the block', async () => {
    const { runtime, auditSink } = createRuntime(
      makeAgent({ allowedPurposes: ['health_assessment'] }),
    )

    const result = await runtime.execute(
      makeRequest({ purpose: 'clinical_conversation' }),
    )

    expect(result.status).toBe('blocked')
    expect(result.message).toBe(
      'Agent is not allowed for this purpose',
    )

    expect(auditSink.getEvents()).toHaveLength(1)
    expect(auditSink.getEvents()[0].status).toBe('blocked')
  })

  it('blocks an undeclared capability and audits the block', async () => {
    const { runtime, auditSink, getExecutionContext } = createRuntime(makeAgent())

    const result = await runtime.execute(
      makeRequest({ requestedCapability: 'appointment.create' }),
    )

    expect(result.status).toBe('blocked')
    expect(result.message).toBe(
      'Agent does not have this capability',
    )

    expect(auditSink.getEvents()).toHaveLength(1)
    expect(auditSink.getEvents()[0]).toMatchObject({
      status: 'blocked',
      message: 'Agent does not have this capability',
    })
  })

  it('preserves the request correlation id', async () => {
    const { runtime, auditSink, getExecutionContext } = createRuntime(makeAgent())

    const result = await runtime.execute(
      makeRequest({ correlationId: 'trace-abc-123' }),
    )

    expect(result.correlationId).toBe('trace-abc-123')
    expect(auditSink.getEvents()[0].metadata.correlationId).toBe(
      'trace-abc-123',
    )
  })
})
