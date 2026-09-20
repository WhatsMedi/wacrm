import type { HealthContextRepository } from './repository'
import {
  HealthContextAccessPolicy,
  type HealthContextAccessRequest,
} from './access-policy'
import type { HealthContext, HealthContextRequest } from './types'

export class HealthContextAccessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HealthContextAccessError'
  }
}

export class HealthContextService {
  constructor(
    private readonly repository: HealthContextRepository,
    private readonly accessPolicy = new HealthContextAccessPolicy(),
  ) {}

  async getContext(
    request: HealthContextRequest,
  ): Promise<HealthContext> {
    const membership =
      await this.repository.getPersonAccountMembership(
        request.accountId,
        request.personId,
      )

    if (membership === null) {
      throw new HealthContextAccessError(
        'Person is not a member of the requested account.',
      )
    }

    if (membership !== 'active') {
      throw new HealthContextAccessError(
        'Person account membership is not active.',
      )
    }

    const accessRequest: HealthContextAccessRequest = {
      accountId: request.accountId,
      personId: request.personId,
      purpose: request.purpose,
      actorType: request.actorType,
      actorId: request.actorId,
    }

    const scope = this.accessPolicy.getScope(accessRequest)

    const items = await this.repository.getHealthContextItems(
      request.accountId,
      request.personId,
      request.purpose,
      request.actorType,
      scope.allowedDomains,
    )

    return {
      accountId: request.accountId,
      personId: request.personId,
      generatedAt: new Date().toISOString(),
      purpose: request.purpose,
      items,
    }
  }
}
