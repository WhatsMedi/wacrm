import type {
  AgentExecutionContext,
  AgentExecutor,
} from './types'
import type { AgentModel } from './model'

export class HealthInformationAgentExecutor implements AgentExecutor {
  private readonly now: () => string

  constructor(
    private readonly model: AgentModel,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.now = now
  }

  async execute(
    context: AgentExecutionContext,
  ) {
    const healthContext = context.healthContext

    if (!healthContext) {
      return {
        status: 'blocked' as const,
        message: 'Health context is required for health information explanation',
        correlationId: context.request.correlationId,
        agentId: context.agent.id,
        startedAt: context.startedAt,
        completedAt: this.now(),
        actions: [],
      }
    }

    const systemPrompt = [
      'You are WhatsMedi Health Information Agent.',
      'Explain health information clearly and conservatively.',
      'Use only the health context supplied to you.',
      'Do not invent clinical facts.',
      'Do not diagnose or prescribe.',
      'If the available information is insufficient, say so clearly.',
      'Preserve uncertainty and verification status.',
      'The user should understand what the information means and what is still unknown.',
      '',
      'Authorized health context:',
      JSON.stringify(healthContext),
    ].join('\n')

    const response = await this.model.generate({
      systemPrompt,
      userMessage: context.request.message,
    })

    return {
      status: 'completed' as const,
      message: response.text,
      correlationId: context.request.correlationId,
      agentId: context.agent.id,
      startedAt: context.startedAt,
      completedAt: this.now(),
      actions: [],
    }
  }
}