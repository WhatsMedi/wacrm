import type { PersonId } from '../identity/types'
import type {
  HealthContextActorType,
  HealthContextPurpose,
} from '../health-context/types'

export type AgentId = string

export type AgentExecutionStatus =
  | 'completed'
  | 'needs_input'
  | 'action_required'
  | 'handed_off'
  | 'blocked'
  | 'failed'

export type AgentCapability =
  | 'health_context.read'
  | 'health_information.explain'
  | 'health_assessment.run'
  | 'provider.search'
  | 'appointment.create'
  | 'diagnostic.order'
  | 'pharmacy.order'
  | 'follow_up.schedule'
  | 'human.handoff'

export interface AgentDefinition {
  id: AgentId
  name: string
  description: string
  version: string
  capabilities: readonly AgentCapability[]
  allowedPurposes: readonly HealthContextPurpose[]
  enabled: boolean
}

export interface AgentRequest {
  accountId: string
  personId: PersonId
  actorType: HealthContextActorType
  actorId: string | null
  purpose: HealthContextPurpose
  message: string
  agentId: AgentId
  requestedCapability: AgentCapability
  correlationId: string
}

export interface AgentExecutionContext {
  request: AgentRequest
  agent: AgentDefinition
  startedAt: string
}

export interface AgentResult {
  status: AgentExecutionStatus
  message: string | null
  correlationId: string
  agentId: AgentId
  startedAt: string
  completedAt: string
  actions: readonly AgentActionResult[]
}

export interface AgentActionResult {
  capability: AgentCapability
  status: 'completed' | 'failed' | 'blocked'
  referenceId: string | null
  message: string | null
}

export interface AgentAuditMetadata {
  correlationId: string
  agentId: AgentId
  agentVersion: string
  actorType: HealthContextActorType
  actorId: string | null
  purpose: HealthContextPurpose
  startedAt: string
  completedAt: string
}
