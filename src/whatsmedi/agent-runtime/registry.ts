import type { AgentDefinition, AgentId } from './types'

export interface AgentRegistry {
  register(agent: AgentDefinition): void
  get(agentId: AgentId): AgentDefinition | null
  listEnabled(): readonly AgentDefinition[]
}

export class InMemoryAgentRegistry implements AgentRegistry {
  private readonly agents = new Map<AgentId, AgentDefinition>()

  register(agent: AgentDefinition): void {
    this.agents.set(agent.id, agent)
  }

  get(agentId: AgentId): AgentDefinition | null {
    return this.agents.get(agentId) ?? null
  }

  listEnabled(): readonly AgentDefinition[] {
    return [...this.agents.values()].filter((agent) => agent.enabled)
  }
}
