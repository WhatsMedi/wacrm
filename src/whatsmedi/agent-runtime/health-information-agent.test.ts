import { describe, expect, it, vi } from 'vitest'
import { AgentCapabilityGate } from './capability-gate'
import { InMemoryAgentAuditSink } from './audit'
import { HealthInformationAgentExecutor } from './health-information-executor'
import { healthInformationAgent } from './agents/health-information'
import { InMemoryAgentRegistry } from './registry'
import { AgentRuntime } from './runtime'
import type { AgentModel } from './model'
import type { HealthContext } from '../health-context/types'
import type { AgentRequest } from './types'
import { createWhatsMediId } from '../types'

describe('Health Information Agent E2E', () => {
  it('executes an authorized health-information request end to end', async () => {
    const registry = new InMemoryAgentRegistry()
    registry.register(healthInformationAgent)

    const auditSink = new InMemoryAgentAuditSink()

    const healthContext: HealthContext = {
      accountId: 'account-1',
      personId: createWhatsMediId('person-1'),
      purpose: 'clinical_conversation',
      generatedAt: '2026-09-20T10:00:00.000Z',
      items: [],
    }

    const healthContextService = {
      getContext: vi.fn().mockResolvedValue(healthContext),
    }

    const model: AgentModel = {
      generate: vi.fn().mockResolvedValue({
        text: 'Your health information can be explained from the records provided.',
      }),
    }

    const executor = new HealthInformationAgentExecutor(
      model,
      () => '2026-09-20T10:00:01.000Z',
    )

    const runtime = new AgentRuntime(
      registry,
      new AgentCapabilityGate(),
      auditSink,
      healthContextService,
      executor,
      () => '2026-09-20T10:00:00.000Z',
    )

    const request: AgentRequest = {
      accountId: 'account-1',
      personId: createWhatsMediId('person-1'),
      actorType: 'patient',
      actorId: 'person-1',
      purpose: 'clinical_conversation',
      message: 'What does my health information mean?',
      agentId: 'health-information',
      requestedCapability: 'health_information.explain',
      correlationId: 'corr-health-info-1',
    }

    const result = await runtime.execute(request)

    expect(result.status).toBe('completed')
    expect(result.agentId).toBe('health-information')
    expect(result.correlationId).toBe('corr-health-info-1')
    expect(result.message).toBe(
      'Your health information can be explained from the records provided.',
    )

    expect(healthContextService.getContext).toHaveBeenCalledOnce()
    expect(model.generate).toHaveBeenCalledOnce()

    const events = auditSink.getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].metadata.correlationId).toBe('corr-health-info-1')
    expect(events[0].metadata.agentId).toBe('health-information')
    expect(events[0].status).toBe('completed')
  })
  it('blocks an unauthorized health-context request before the model is called', async () => {
    const registry = new InMemoryAgentRegistry()
    registry.register(healthInformationAgent)

    const auditSink = new InMemoryAgentAuditSink()

    const healthContextService = {
      getContext: vi.fn().mockRejectedValue(
        new Error(
          'Actor is not authorized to access this person health context for the requested purpose.',
        ),
      ),
    }

    const model: AgentModel = {
      generate: vi.fn(),
    }

    const executor = new HealthInformationAgentExecutor(model)

    const runtime = new AgentRuntime(
      registry,
      new AgentCapabilityGate(),
      auditSink,
      healthContextService,
      executor,
    )

    const result = await runtime.execute({
      accountId: 'account-2',
      personId: createWhatsMediId('person-1'),
      actorType: 'patient',
      actorId: 'person-1',
      purpose: 'clinical_conversation',
      message: 'What does my health information mean?',
      agentId: 'health-information',
      requestedCapability: 'health_information.explain',
      correlationId: 'corr-health-info-blocked',
    })

    expect(result.status).toBe('blocked')
    expect(result.message).toContain('not authorized')
    expect(model.generate).not.toHaveBeenCalled()

    const events = auditSink.getEvents()

    expect(events).toHaveLength(1)
    expect(events[0].status).toBe('blocked')
    expect(events[0].metadata.correlationId).toBe(
      'corr-health-info-blocked',
    )
  })
})
