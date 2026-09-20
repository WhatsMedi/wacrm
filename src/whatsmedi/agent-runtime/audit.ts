import type {
  AgentAuditMetadata,
  AgentResult,
} from './types'

export interface AgentAuditEvent {
  metadata: AgentAuditMetadata
  status: AgentResult['status']
  message: string | null
  actions: AgentResult['actions']
}

export interface AgentAuditSink {
  record(event: AgentAuditEvent): Promise<void>
}

export class InMemoryAgentAuditSink implements AgentAuditSink {
  private readonly events: AgentAuditEvent[] = []

  async record(event: AgentAuditEvent): Promise<void> {
    this.events.push(event)
  }

  getEvents(): readonly AgentAuditEvent[] {
    return [...this.events]
  }
}
