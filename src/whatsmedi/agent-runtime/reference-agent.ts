import type {
  AgentExecutionContext,
  AgentExecutor,
  AgentResult,
} from './types'
import type { AgentModel } from './model'
import { ToolExecutor } from './tool-executor'
import { getHealthContextTool } from './reference-tool'

export class ReferenceHealthAgentExecutor implements AgentExecutor {
  constructor(
    private readonly toolExecutor: ToolExecutor,
    private readonly model: AgentModel,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async execute(context: AgentExecutionContext): Promise<AgentResult> {
    const toolContext = {
      accountId: context.request.accountId,
      personId: context.request.personId,
      actorType: context.request.actorType,
      actorId: context.request.actorId,
      purpose: context.request.purpose,
      correlationId: context.request.correlationId,
      agent: context.agent,
      healthContext: context.healthContext,
      requestMessage: context.request.message,
    }

    const toolResult = await this.toolExecutor.execute(
      getHealthContextTool.name,
      {},
      toolContext,
    )

    if (toolResult.status !== 'completed' || !toolResult.output) {
      return {
        status: toolResult.status,
        message: toolResult.message,
        correlationId: context.request.correlationId,
        agentId: context.agent.id,
        startedAt: context.startedAt,
        completedAt: this.now(),
        actions: [
          {
            capability: 'health_context.read',
            status: toolResult.status === 'blocked' ? 'blocked' : 'failed',
            referenceId: toolResult.audit.toolName,
            message: toolResult.message,
          },
        ],
      }
    }

    const response = await this.model.generate({
      systemPrompt: [
        'You are the WhatsMedi Reference Health Agent.',
        'Use only the authorized health context supplied by the controlled tool.',
        'Do not invent clinical facts.',
        'Do not diagnose or prescribe.',
        'Preserve uncertainty.',
        '',
        'Authorized health context:',
        JSON.stringify(toolResult.output),
      ].join('\n'),
      userMessage: context.request.message,
    })

    return {
      status: 'completed',
      message: response.text,
      correlationId: context.request.correlationId,
      agentId: context.agent.id,
      startedAt: context.startedAt,
      completedAt: this.now(),
      actions: [
        {
          capability: 'health_context.read',
          status: 'completed',
          referenceId: toolResult.audit.toolName,
          message: 'Authorized health context supplied through controlled tool.',
        },
      ],
    }
  }
}