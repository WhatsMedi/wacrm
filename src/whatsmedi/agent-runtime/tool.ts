import type { HealthContext } from '../health-context/types'
import type {
  AgentCapability,
  AgentDefinition,
  AgentRequest,
} from './types'

export type ToolName = string

export interface ToolPermission {
  requiredCapabilities: readonly AgentCapability[]
  allowedPurposes?: readonly AgentRequest['purpose'][]
}

export interface ToolExecutionContext {
  accountId: string
  personId: AgentRequest['personId']
  actorType: AgentRequest['actorType']
  actorId: string | null
  purpose: AgentRequest['purpose']
  correlationId: string
  agent: AgentDefinition
  healthContext: HealthContext | null
  requestMessage: string
}

export interface ToolAuditMetadata {
  correlationId: string
  toolName: ToolName
  agentId: string
  agentVersion: string
  accountId: string
  personId: AgentRequest['personId']
  purpose: AgentRequest['purpose']
  startedAt: string
  completedAt: string
}

export interface ToolExecutionResult<TOutput> {
  status: 'completed' | 'blocked' | 'failed'
  output: TOutput | null
  message: string | null
  audit: ToolAuditMetadata
}

export interface ToolDefinition<TInput, TOutput> {
  name: ToolName
  description: string
  permission: ToolPermission

  execute(
    input: TInput,
    context: ToolExecutionContext,
  ): Promise<TOutput>
}

export type RegisteredTool = ToolDefinition<unknown, unknown>
