import type { PersonId } from '../identity/types'

export type HealthContextPurpose =
  | 'clinical_conversation'
  | 'health_assessment'
  | 'medication_action'
  | 'appointment_booking'
  | 'diagnostic_action'
  | 'care_coordination'
  | 'follow_up'

export type HealthContextActorType =
  | 'patient'
  | 'caregiver'
  | 'provider'
  | 'agent'
  | 'system'

export interface HealthContextRequest {
  accountId: string
  personId: PersonId
  purpose: HealthContextPurpose
  actorType: HealthContextActorType
  actorId: string | null
}

export interface HealthContextItem {
  domain:
    | 'condition'
    | 'medication'
    | 'allergy'
    | 'observation'
    | 'encounter'
    | 'procedure'
    | 'document'
    | 'event'

  id: string
  displayText: string
  verificationStatus: 'unverified' | 'verified' | 'rejected' | 'superseded'
  source:
    | 'self_reported'
    | 'provider_entered'
    | 'imported'
    | 'document_extracted'
    | 'system_recorded'
    | 'ai_suggested'
  sourceReference: string | null
  recordedAt: string
  effectiveAt: string | null
}

export interface HealthContext {
  accountId: string
  personId: PersonId
  generatedAt: string
  purpose: HealthContextPurpose
  items: HealthContextItem[]
}
