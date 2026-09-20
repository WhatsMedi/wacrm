import type { AgentCapability, AgentDefinition } from './types'

export interface CapabilityCheck {
  allowed: boolean
  reason: string | null
}

export class AgentCapabilityGate {
  check(
    agent: AgentDefinition,
    capability: AgentCapability,
  ): CapabilityCheck {
    if (!agent.enabled) {
      return {
        allowed: false,
        reason: 'Agent is disabled',
      }
    }

    if (!agent.capabilities.includes(capability)) {
      return {
        allowed: false,
        reason: 'Agent does not have this capability',
      }
    }

    return {
      allowed: true,
      reason: null,
    }
  }
}
