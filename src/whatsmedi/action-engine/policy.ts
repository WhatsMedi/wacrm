import type {
  HealthcareActionRequest,
  HealthcareActionType,
} from './types'

export interface HealthcareActionPolicyDecision {
  allowed: boolean
  reason: string | null
}

const PATIENT_ALLOWED_ACTIONS: readonly HealthcareActionType[] = [
  'provider.search',
  'appointment.create',
  'diagnostic.order',
  'pharmacy.order',
  'follow_up.schedule',
  'human.handoff',
]

const CAREGIVER_ALLOWED_ACTIONS: readonly HealthcareActionType[] = [
  'provider.search',
  'appointment.create',
  'diagnostic.order',
  'pharmacy.order',
  'follow_up.schedule',
  'human.handoff',
]

const PROVIDER_ALLOWED_ACTIONS: readonly HealthcareActionType[] = [
  'provider.search',
  'appointment.create',
  'diagnostic.order',
  'pharmacy.order',
  'follow_up.schedule',
  'human.handoff',
]

const AGENT_ALLOWED_ACTIONS: readonly HealthcareActionType[] = [
  'provider.search',
  'appointment.create',
  'diagnostic.order',
  'pharmacy.order',
  'follow_up.schedule',
  'human.handoff',
]

const SYSTEM_ALLOWED_ACTIONS: readonly HealthcareActionType[] = [
  'provider.search',
  'appointment.create',
  'diagnostic.order',
  'pharmacy.order',
  'follow_up.schedule',
  'human.handoff',
]

const ACTOR_ACTIONS = {
  patient: PATIENT_ALLOWED_ACTIONS,
  caregiver: CAREGIVER_ALLOWED_ACTIONS,
  provider: PROVIDER_ALLOWED_ACTIONS,
  agent: AGENT_ALLOWED_ACTIONS,
  system: SYSTEM_ALLOWED_ACTIONS,
} as const

export class HealthcareActionPolicy {
  check(
    request: HealthcareActionRequest,
  ): HealthcareActionPolicyDecision {
    const allowedActions = ACTOR_ACTIONS[request.actorType]

    if (!allowedActions.includes(request.actionType)) {
      return {
        allowed: false,
        reason: 'Actor is not allowed to request this action',
      }
    }

    return {
      allowed: true,
      reason: null,
    }
  }
}
