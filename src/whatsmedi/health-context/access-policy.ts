import type {
  HealthContextActorType,
  HealthContextPurpose,
  HealthContextItem,
} from './types'

export type HealthContextDomain = HealthContextItem['domain']

export interface HealthContextAccessRequest {
  accountId: string
  personId: string
  purpose: HealthContextPurpose
  actorType: HealthContextActorType
  actorId: string
}

export interface HealthContextAccessScope {
  allowedDomains: readonly HealthContextDomain[]
}

const PURPOSE_DOMAIN_SCOPE: Record<
  HealthContextPurpose,
  readonly HealthContextDomain[]
> = {
  clinical_conversation: [
    'condition',
    'medication',
    'allergy',
    'observation',
    'encounter',
    'document',
    'event',
  ],

  health_assessment: [
    'condition',
    'medication',
    'allergy',
    'observation',
  ],

  medication_action: [
    'condition',
    'medication',
    'allergy',
    'observation',
  ],

  appointment_booking: [
    'condition',
    'encounter',
    'procedure',
    'document',
  ],

  diagnostic_action: [
    'condition',
    'observation',
    'document',
    'encounter',
  ],

  care_coordination: [
    'condition',
    'medication',
    'allergy',
    'observation',
    'encounter',
    'procedure',
    'document',
    'event',
  ],

  follow_up: [
    'condition',
    'medication',
    'observation',
    'encounter',
    'procedure',
    'event',
  ],
}

export class HealthContextAccessPolicy {
  getScope(
    request: HealthContextAccessRequest,
  ): HealthContextAccessScope {
    void request.actorType
    void request.actorId
    void request.accountId
    void request.personId

    return {
      allowedDomains: PURPOSE_DOMAIN_SCOPE[request.purpose],
    }
  }

  isDomainAllowed(
    request: HealthContextAccessRequest,
    domain: HealthContextDomain,
  ): boolean {
    return this.getScope(request).allowedDomains.includes(domain)
  }
}
