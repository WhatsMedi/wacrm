import type {
  AgentRequest,
  AgentResult,
} from './types'
import type { AgentRegistry } from './registry'
import { AgentCapabilityGate } from './capability-gate'
import type { AgentAuditSink } from './audit'

export class AgentRuntime {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly capabilityGate: AgentCapabilityGate,
    private readonly auditSink: AgentAuditSink,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async execute(request: AgentRequest): Promise<AgentResult> {
    const startedAt = this.now()
    const agent = this.registry.get(request.agentId)

    if (!agent) {
      return this.finish(
        request,
        {
          status: 'failed',
          message: 'Agent not found',
          correlationId: request.correlationId,
          agentId: request.agentId,
          startedAt,
          completedAt: this.now(),
          actions: [],
        },
        null,
      )
    }

    if (!agent.enabled) {
      return this.finish(
        request,
        {
          status: 'blocked',
          message: 'Agent is disabled',
          correlationId: request.correlationId,
          agentId: agent.id,
          startedAt,
          completedAt: this.now(),
          actions: [],
        },
        agent,
      )
    }

    if (!agent.allowedPurposes.includes(request.purpose)) {
      return this.finish(
        request,
        {
          status: 'blocked',
          message: 'Agent is not allowed for this purpose',
          correlationId: request.correlationId,
          agentId: agent.id,
          startedAt,
          completedAt: this.now(),
          actions: [],
        },
        agent,
      )
    }

    const capabilityCheck = this.capabilityGate.check(
      agent,
      request.requestedCapability,
    )

    if (!capabilityCheck.allowed) {
      return this.finish(
        request,
        {
          status: 'blocked',
          message: capabilityCheck.reason,
          correlationId: request.correlationId,
          agentId: agent.id,
          startedAt,
          completedAt: this.now(),
          actions: [],
        },
        agent,
      )
    }

    return this.finish(
      request,
      {
        status: 'needs_input',
        message: 'Agent execution boundary reached',
        correlationId: request.correlationId,
        agentId: agent.id,
        startedAt,
        completedAt: this.now(),
        actions: [],
      },
      agent,
    )
  }

  private async finish(
    request: AgentRequest,
    result: AgentResult,
    agent: AgentResult extends never ? never : { version: string } | null,
  ): Promise<AgentResult> {
    await this.auditSink.record({
      metadata: {
        correlationId: request.correlationId,
        agentId: result.agentId,
        agentVersion: agent?.version ?? 'unknown',
        actorType: request.actorType,
        actorId: request.actorId,
        purpose: request.purpose,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
      },
      status: result.status,
      message: result.message,
      actions: result.actions,
    })

    return result
  }
}
