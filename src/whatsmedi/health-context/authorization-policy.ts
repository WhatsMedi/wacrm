import type { PersonId } from '../identity/types'
import type {
  HealthContextActorType,
  HealthContextPurpose,
} from './types'
import type {
  HealthContextAuthorization,
  HealthContextAuthorizationRepository,
} from './authorization'

export interface HealthContextAuthorizationRequest {
  accountId: string
  personId: PersonId
  actorType: HealthContextActorType
  actorId: string | null
  purpose: HealthContextPurpose
}

export class HealthContextAuthorizationPolicy {
  constructor(
    private readonly repository: HealthContextAuthorizationRepository,
  ) {}

  async isAuthorized(
    request: HealthContextAuthorizationRequest,
  ): Promise<boolean> {
    if (!request.actorId) {
      return false
    }

    // Patient self-access is allowed only when the actor identity
    // exactly matches the canonical Person identity.
    if (request.actorType === 'patient') {
      return request.actorId === request.personId
    }

    const authorization = await this.repository.getAuthorization(
      request.accountId,
      request.personId,
      request.actorType,
      request.actorId,
      request.purpose,
    )

    return this.isActiveAuthorization(authorization)
  }

  private isActiveAuthorization(
    authorization: HealthContextAuthorization | null,
  ): boolean {
    if (!authorization || authorization.status !== 'active') {
      return false
    }

    if (
      authorization.expiresAt !== null &&
      new Date(authorization.expiresAt).getTime() <= Date.now()
    ) {
      return false
    }

    return true
  }
}
