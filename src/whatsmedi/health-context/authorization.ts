import type { PersonId } from '../identity/types'
import type {
  HealthContextActorType,
  HealthContextPurpose,
} from './types'

export type HealthContextAuthorizationStatus =
  | 'active'
  | 'revoked'
  | 'expired'

export interface HealthContextAuthorization {
  accountId: string
  personId: PersonId
  actorType: HealthContextActorType
  actorId: string
  purpose: HealthContextPurpose
  relationship: string
  status: HealthContextAuthorizationStatus
  expiresAt: string | null
}

export interface HealthContextAuthorizationRepository {
  getAuthorization(
    accountId: string,
    personId: PersonId,
    actorType: HealthContextActorType,
    actorId: string,
    purpose: HealthContextPurpose,
  ): Promise<HealthContextAuthorization | null>
}
