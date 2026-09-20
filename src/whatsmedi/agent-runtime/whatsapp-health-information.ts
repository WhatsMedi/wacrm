import type { SupabaseClient } from '@supabase/supabase-js'
import { createWhatsMediId } from '../types'
import type { HealthContextActorType } from '../health-context/types'
import { AgentRuntime } from './runtime'
import { AgentCapabilityGate } from './capability-gate'
import { InMemoryAgentAuditSink } from './audit'
import { HealthContextService } from '../health-context/service'
import { HealthContextAccessPolicy } from '../health-context/access-policy'
import { HealthContextAuthorizationPolicy } from '../health-context/authorization-policy'
import { SupabaseHealthContextRepository } from '../health-context/supabase-repository'
import { HealthInformationAgentExecutor } from './health-information-executor'
import { WacrmAgentModel } from './wacrm-agent-model'
import { healthInformationAgent } from './agents/health-information'
import { InMemoryAgentRegistry } from './registry'

export async function runWhatsMediHealthInformation(params: {
  db: SupabaseClient
  accountId: string
  personId: string
  actorType: HealthContextActorType
  actorId: string | null
  message: string
  correlationId: string
}) {
  const registry = new InMemoryAgentRegistry()
  registry.register(healthInformationAgent)

  const healthRepository = new SupabaseHealthContextRepository(params.db)
  const healthContextService = new HealthContextService(
    healthRepository,
    new HealthContextAccessPolicy(),
    new HealthContextAuthorizationPolicy(healthRepository),
  )

  const model = new WacrmAgentModel(params.db, params.accountId)
  const executor = new HealthInformationAgentExecutor(model)

  const runtime = new AgentRuntime(
    registry,
    new AgentCapabilityGate(),
    new InMemoryAgentAuditSink(),
    healthContextService,
    executor,
  )

  return runtime.execute({
    accountId: params.accountId,
    personId: createWhatsMediId(params.personId),
    actorType: params.actorType,
    actorId: params.actorId ? createWhatsMediId(params.actorId) : null,
    purpose: 'clinical_conversation',
    message: params.message,
    agentId: healthInformationAgent.id,
    requestedCapability: 'health_information.explain',
    correlationId: params.correlationId,
  })
}




