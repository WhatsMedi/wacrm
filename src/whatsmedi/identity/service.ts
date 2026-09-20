import type { IdentityRepository } from './repository'
import type {
  PersonId,
  WacrmContactMapping,
  WacrmContactInput,
  ResolvedIdentityContext,
} from './types'

/**
 * Strips all non-digit characters to yield canonical digits-only phone numbers.
 * Matches WACRM's standard phone normalization behavior.
 */
export function normalizePhoneNumber(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.replace(/\D/g, '')
}

/**
 * Trims and validates WhatsApp Business-Scoped User ID (BSUID).
 */
export function normalizeWhatsAppUserId(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (!/^[A-Za-z]{2}\.(?:ENT\.)?[A-Za-z0-9]{4,}$/.test(trimmed)) {
    throw new Error('WhatsApp user ID must be a valid BSUID')
  }
  return trimmed
}

export class IdentityService {
  constructor(private readonly repo: IdentityRepository) {}

  /**
   * Resolves or provisions a canonical Person and WhatsAppIdentity
   * for a given WACRM Contact within an account context.
   *
   * Invariants enforced:
   * 1. Resolution is strictly account-scoped — zero cross-account identity disclosure.
   * 2. Idempotent: repeated lookups with the same WACRM contact resolve the existing mapping.
   * 3. Channels discovered within the account are deduplicated without leaking to other accounts.
   * 4. Family sharing and multiple-person-per-WhatsApp-identity are NOT implemented in Phase 1
   *    and are reserved for a future governed relationship model (Phase 1 maintains 1:1 identity).
   */
  async resolveFromWacrmContact(
    input: WacrmContactInput
  ): Promise<ResolvedIdentityContext> {
    const accountId = input.accountId?.trim()
    const wacrmContactId = input.wacrmContactId?.trim()

    if (!accountId) {
      throw new Error('accountId is required for identity resolution')
    }
    if (!wacrmContactId) {
      throw new Error('wacrmContactId is required for identity resolution')
    }

    const phoneNumber = normalizePhoneNumber(input.phoneNormalized || input.phone)
    const whatsappUserId = normalizeWhatsAppUserId(input.waUserId)

    if (!phoneNumber && !whatsappUserId) {
      throw new Error(
        'Contact must have either a valid phone number or WhatsApp user ID'
      )
    }

    return this.repo.resolveFromWacrmContact({
      accountId,
      wacrmContactId,
      phone: phoneNumber,
      phoneNormalized: phoneNumber,
      waUserId: whatsappUserId,
      name: input.name?.trim() || null,
      source: input.source ?? 'whatsapp',
    })
  }

  async getPersonById(personId: PersonId) {
    return this.repo.findPersonById(personId)
  }

  async getMappingByWacrmContactId(
    accountId: string,
    wacrmContactId: string
  ): Promise<WacrmContactMapping | null> {
    return this.repo.findMappingByWacrmContactId(accountId, wacrmContactId)
  }
}
