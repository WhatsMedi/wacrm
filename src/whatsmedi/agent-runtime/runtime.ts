import type { HealthContext } from '../health-context/types'
import type {
  AgentExecutionContext,
  AgentExecutor,
  AgentRequest,
  AgentResult,
} from './types'
import type { AgentRegistry } from './registry'
import { AgentCapabilityGate } from './capability-gate'
import { capabilityRequiresHealthContext } from './health-context-requirement'
import type { AgentAuditSink } from './audit'
interface HealthContextReader {
  getContext(request: {
    accountId: string
    personId: string
    purpose: AgentRequest['purpose']
    actorType: AgentRequest['actorType']
    actorId: string | null
  }): Promise<HealthContext>
}

export class AgentRuntime {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly capabilityGate: AgentCapabilityGate,
    private readonly auditSink: AgentAuditSink,
    private readonly healthContextService: HealthContextReader,
    private readonly executor: AgentExecutor,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async execute(request: AgentRequest): Promise<AgentResult> {
    const startedAt = this.now()
    let healthContext: HealthContext | null = null
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

    if (capabilityRequiresHealthContext(request.requestedCapability)) {
      try {
        healthContext = await this.healthContextService.getContext({
          accountId: request.accountId,
          personId: request.personId,
          purpose: request.purpose,
          actorType: request.actorType,
          actorId: request.actorId,
        })
      } catch (error) {
        return this.finish(
          request,
          {
            status: 'blocked',
            message:
              error instanceof Error
                ? error.message
                : 'Health context access was blocked',
            correlationId: request.correlationId,
            agentId: agent.id,
            startedAt,
            completedAt: this.now(),
            actions: [],
          },
          agent,
        )
      }
    }

    const executionContext: AgentExecutionContext = {
      request,
      agent,
      healthContext,
      startedAt,
    }

    try {
      const result = await this.executor.execute(executionContext)

      return this.finish(request, result, agent)
    } catch (error) {
      return this.finish(
        request,
        {
          status: 'failed',
          message:
            error instanceof Error
              ? error.message
              : 'Agent execution failed',
          correlationId: request.correlationId,
          agentId: agent.id,
          startedAt,
          completedAt: this.now(),
          actions: [],
        },
        agent,
      )
    }
  }

  private async finish(
    request: AgentRequest,
    result: AgentResult,
    agent: { version: string } | null,
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
