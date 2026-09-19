import { createWhatsMediId } from '../types'
import type { IdentityRepository } from './repository'
import type {
  Person,
  PersonId,
  WhatsAppIdentity,
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
  return trimmed.length > 0 ? trimmed : null
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

    // 1. Check if mapping already exists for this exact (accountId, wacrmContactId)
    const existingMapping = await this.repo.findMappingByWacrmContactId(
      accountId,
      wacrmContactId
    )

    if (existingMapping) {
      const person = await this.repo.findPersonById(existingMapping.personId)
      const identity = await this.repo.findWhatsAppIdentityById(
        existingMapping.whatsappIdentityId
      )

      if (person && identity) {
        // Opportunistically backfill missing phone or BSUID if newly supplied
        let identityToReturn = identity
        const patch: Partial<WhatsAppIdentity> = {}
        if (phoneNumber && !identity.phoneNumber) {
          patch.phoneNumber = phoneNumber
        }
        if (whatsappUserId && !identity.whatsappUserId) {
          patch.whatsappUserId = whatsappUserId
        }
        if (Object.keys(patch).length > 0) {
          identityToReturn = await this.repo.updateWhatsAppIdentity(
            identity.id,
            patch
          )
        }

        return {
          person,
          whatsappIdentity: identityToReturn,
          mapping: existingMapping,
          isNewPerson: false,
        }
      }
    }

    // 2. Check if WhatsAppIdentity already exists within THIS account
    // (Notice: find methods require accountId — zero cross-account matching)
    let existingIdentity: WhatsAppIdentity | null = null

    if (whatsappUserId) {
      existingIdentity = await this.repo.findWhatsAppIdentityByWaUserId(
        accountId,
        whatsappUserId
      )
    }

    if (!existingIdentity && phoneNumber) {
      existingIdentity = await this.repo.findWhatsAppIdentityByPhone(
        accountId,
        phoneNumber
      )
    }

    if (existingIdentity) {
      const person = await this.repo.findPersonById(existingIdentity.personId)
      if (!person) {
        throw new Error(
          `Orphaned identity: Person not found for id ${existingIdentity.personId}`
        )
      }

      // Backfill BSUID or phone if newly discovered
      let identityToReturn = existingIdentity
      const patch: Partial<WhatsAppIdentity> = {}
      if (phoneNumber && !existingIdentity.phoneNumber) {
        patch.phoneNumber = phoneNumber
      }
      if (whatsappUserId && !existingIdentity.whatsappUserId) {
        patch.whatsappUserId = whatsappUserId
      }
      if (Object.keys(patch).length > 0) {
        identityToReturn = await this.repo.updateWhatsAppIdentity(
          existingIdentity.id,
          patch
        )
      }

      // Create new mapping for this wacrmContactId linked to existing person & identity
      const mappingId = createWhatsMediId(crypto.randomUUID())
      const mapping = await this.repo.createMapping({
        id: mappingId,
        accountId,
        wacrmContactId,
        personId: person.id,
        whatsappIdentityId: identityToReturn.id,
      })

      return {
        person,
        whatsappIdentity: identityToReturn,
        mapping,
        isNewPerson: false,
      }
    }

    // 3. Provision new Person + new WhatsAppIdentity + new WacrmContactMapping
    const personId = createWhatsMediId(crypto.randomUUID())
    const person = await this.repo.createPerson({
      id: personId,
      displayName: input.name?.trim() || null,
    })

    const identityId = createWhatsMediId(crypto.randomUUID())
    const whatsappIdentity = await this.repo.createWhatsAppIdentity({
      id: identityId,
      accountId,
      personId: person.id,
      phoneNumber,
      whatsappUserId,
      status: 'active',
      source: input.source || 'whatsapp',
    })

    const mappingId = createWhatsMediId(crypto.randomUUID())
    const mapping = await this.repo.createMapping({
      id: mappingId,
      accountId,
      wacrmContactId,
      personId: person.id,
      whatsappIdentityId: whatsappIdentity.id,
    })

    return {
      person,
      whatsappIdentity,
      mapping,
      isNewPerson: true,
    }
  }

  async getPersonById(personId: PersonId): Promise<Person | null> {
    return this.repo.findPersonById(personId)
  }

  async getMappingByWacrmContactId(
    accountId: string,
    wacrmContactId: string
  ): Promise<WacrmContactMapping | null> {
    return this.repo.findMappingByWacrmContactId(accountId, wacrmContactId)
  }
}
