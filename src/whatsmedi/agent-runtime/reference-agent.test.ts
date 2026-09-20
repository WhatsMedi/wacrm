import { describe, expect, it, vi } from 'vitest'
import { createWhatsMediId } from '../types'
import type { HealthContext } from '../health-context/types'
import { InMemoryAgentAuditSink } from './audit'
import { AgentCapabilityGate } from './capability-gate'
import { InMemoryAgentRegistry } from './registry'
import { AgentRuntime } from './runtime'
import { InMemoryToolRegistry } from './tool-registry'
import { ToolExecutor } from './tool-executor'
import { ReferenceHealthAgentExecutor } from './reference-agent'
import type { AgentDefinition, AgentRequest } from './types'
import type { AgentModel } from './model'
import { getHealthContextTool } from './reference-tool'

describe('Reference Agent E2E', () => {
  const healthContext = {
    purpose: 'clinical_conversation',
    items: [],
  } as unknown as HealthContext

  const agent: AgentDefinition = {
    id: 'reference-health-agent',
    name: 'Reference Health Agent',
    description: 'Reference integration agent for WhatsMedi.',
    version: '1.0.0',
    capabilities: [
      'health_context.read',
      'health_information.explain',
    ],
    allowedPurposes: ['clinical_conversation'],
    enabled: true,
  }

  const request: AgentRequest = {
    accountId: 'account-1',
    personId: createWhatsMediId('person-1'),
    actorType: 'patient',
    actorId: 'person-1',
    purpose: 'clinical_conversation',
    message: 'Help me understand my health information.',
    agentId: agent.id,
    requestedCapability: 'health_information.explain',
    correlationId: 'correlation-1',
  }

  it('executes the complete reference path and records audit metadata', async () => {
    const registry = new InMemoryAgentRegistry()
    registry.register(agent)

    const toolRegistry = new InMemoryToolRegistry()
    toolRegistry.register(getHealthContextTool)

    const toolExecutor = new ToolExecutor(
      toolRegistry,
      () => '2026-09-20T18:00:00.000Z',
    )

    const model: AgentModel = {
      generate: vi.fn(async ({ systemPrompt }) => {
        expect(systemPrompt).toContain('Authorized health context:')
        return {
          text: 'I can explain the available health information using the authorized context.',
        }
      }),
    }

    const healthContextService = {
      getContext: vi.fn(async () => healthContext),
    }

    const auditSink = new InMemoryAgentAuditSink()

    const executor = new ReferenceHealthAgentExecutor(
      toolExecutor,
      model,
      () => '2026-09-20T18:00:01.000Z',
    )

    const runtime = new AgentRuntime(
      registry,
      new AgentCapabilityGate(),
      auditSink,
      healthContextService,
      executor,
      () => '2026-09-20T18:00:00.000Z',
    )

    const result = await runtime.execute(request)

    expect(result.status).toBe('completed')
    expect(result.message).toContain('authorized context')
    expect(healthContextService.getContext).toHaveBeenCalledOnce()
    expect(model.generate).toHaveBeenCalledOnce()

    const events = auditSink.getEvents()

    expect(events).toHaveLength(1)
    expect(events[0].metadata.correlationId).toBe('correlation-1')
    expect(events[0].metadata.agentId).toBe('reference-health-agent')
    expect(events[0].status).toBe('completed')
    expect(events[0].actions[0]).toMatchObject({
      capability: 'health_context.read',
      status: 'completed',
      referenceId: 'get_health_context',
    })
  })

  it('blocks the reference path when health context cannot be obtained', async () => {
    const registry = new InMemoryAgentRegistry()
    registry.register(agent)

    const toolRegistry = new InMemoryToolRegistry()
    toolRegistry.register(getHealthContextTool)

    const toolExecutor = new ToolExecutor(toolRegistry)

    const model: AgentModel = {
      generate: vi.fn(async () => ({
        text: 'This must never execute.',
      })),
    }

    const healthContextService = {
      getContext: vi.fn(async () => {
        throw new Error('Health context authorization failed')
      }),
    }

    const auditSink = new InMemoryAgentAuditSink()

    const executor = new ReferenceHealthAgentExecutor(
      toolExecutor,
      model,
    )

    const runtime = new AgentRuntime(
      registry,
      new AgentCapabilityGate(),
      auditSink,
      healthContextService,
      executor,
    )

    const result = await runtime.execute(request)

    expect(result.status).toBe('blocked')
    expect(result.message).toContain('Health context authorization failed')
    expect(model.generate).not.toHaveBeenCalled()
    expect(auditSink.getEvents()).toHaveLength(1)
    expect(auditSink.getEvents()[0].status).toBe('blocked')
  })
})