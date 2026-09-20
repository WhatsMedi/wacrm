import type { PersonId } from '../identity/types'
import type {
  HealthContextActorType,
  HealthContextItem,
  HealthContextPurpose,
} from './types'
import type { HealthContextDomain } from './access-policy'
import type { HealthContextAuthorizationRepository } from './authorization'

export interface HealthContextRepository
  extends HealthContextAuthorizationRepository {
  getPersonAccountMembership(
    accountId: string,
    personId: PersonId,
  ): Promise<'active' | 'inactive' | null>

  getHealthContextItems(
    accountId: string,
    personId: PersonId,
    purpose: HealthContextPurpose,
    actorType: HealthContextActorType,
    allowedDomains: readonly HealthContextDomain[],
  ): Promise<HealthContextItem[]>
}
