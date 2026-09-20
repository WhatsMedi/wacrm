import type { AgentCapability } from './types'

export function capabilityRequiresHealthContext(
  capability: AgentCapability,
): boolean {
  switch (capability) {
    case 'health_context.read':
    case 'health_information.explain':
    case 'health_assessment.run':
    case 'appointment.create':
    case 'diagnostic.order':
    case 'pharmacy.order':
    case 'follow_up.schedule':
      return true

    case 'provider.search':
    case 'human.handoff':
      return false
  }
}
