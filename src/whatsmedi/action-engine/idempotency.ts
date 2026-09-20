import type {
  HealthcareAction,
  HealthcareActionResult,
} from './types'

export interface HealthcareActionIdempotencyStore {
  get(
    accountId: string,
    idempotencyKey: string,
  ): Promise<HealthcareActionResult | null>

  set(
    accountId: string,
    idempotencyKey: string,
    result: HealthcareActionResult,
  ): Promise<void>
}

export class InMemoryHealthcareActionIdempotencyStore
  implements HealthcareActionIdempotencyStore
{
  private readonly results = new Map<
    string,
    HealthcareActionResult
  >()

  async get(
    accountId: string,
    idempotencyKey: string,
  ): Promise<HealthcareActionResult | null> {
    return this.results.get(this.key(accountId, idempotencyKey)) ?? null
  }

  async set(
    accountId: string,
    idempotencyKey: string,
    result: HealthcareActionResult,
  ): Promise<void> {
    this.results.set(
      this.key(accountId, idempotencyKey),
      result,
    )
  }

  private key(accountId: string, idempotencyKey: string): string {
    return `${accountId}:${idempotencyKey}`
  }
}
