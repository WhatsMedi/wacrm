import type { PersonId } from '../identity/types'
import type {
  HealthContextActorType,
} from '../health-context/types'

export type HealthcareActionType =
  | 'provider.search'
  | 'appointment.create'
  | 'diagnostic.order'
  | 'pharmacy.order'
  | 'follow_up.schedule'
  | 'human.handoff'

export type HealthcareActionStatus =
  | 'requested'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked'

export interface HealthcareActionRequest {
  accountId: string
  personId: PersonId
  actorType: HealthContextActorType
  actorId: string | null
  actionType: HealthcareActionType
  correlationId: string
  idempotencyKey: string
  payload: Readonly<Record<string, unknown>>
}

export interface HealthcareAction {
  id: string
  accountId: string
  personId: PersonId
  actorType: HealthContextActorType
  actorId: string | null
  actionType: HealthcareActionType
  status: HealthcareActionStatus
  correlationId: string
  idempotencyKey: string
  payload: Readonly<Record<string, unknown>>
  createdAt: string
  updatedAt: string
}

export interface HealthcareActionResult {
  action: HealthcareAction
  message: string | null
  referenceId: string | null
}
