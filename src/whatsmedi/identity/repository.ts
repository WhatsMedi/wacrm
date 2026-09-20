import type {
  Person,
  WhatsAppIdentity,
  WacrmContactMapping,
  ResolvedIdentityContext,
  WacrmContactInput,
} from './types'

export interface IdentityRepository {
  /**
   * Atomically resolves the complete identity context. Implementations must
   * never expose the individual Person / identity / mapping writes as a
   * production provisioning path.
   */
  resolveFromWacrmContact(
    input: WacrmContactInput
  ): Promise<ResolvedIdentityContext>

  findMappingByWacrmContactId(
    accountId: string,
    wacrmContactId: string
  ): Promise<WacrmContactMapping | null>

  findPersonById(personId: string): Promise<Person | null>
}

/**
 * Deterministic in-memory repository for test suites and isolated execution
 * without database dependencies.
 */
export class InMemoryIdentityRepository implements IdentityRepository {
  private readonly persons = new Map<string, Person>()
  private readonly identities = new Map<string, WhatsAppIdentity>()
  private readonly mappings = new Map<string, WacrmContactMapping>()

  async resolveFromWacrmContact(
    input: WacrmContactInput
  ): Promise<ResolvedIdentityContext> {
    const phoneNumber = input.phoneNormalized ?? input.phone
    const whatsappUserId = input.waUserId ?? null
    const existingMapping = await this.findMappingByWacrmContactId(
      input.accountId,
      input.wacrmContactId
    )

    if (existingMapping) {
      const person = await this.findPersonById(existingMapping.personId)
      const identity = this.identities.get(existingMapping.whatsappIdentityId)
      if (!person || !identity) throw new Error('Identity mapping is inconsistent')
      if (phoneNumber && identity.phoneNumber && identity.phoneNumber !== phoneNumber) {
        throw new Error('Phone number does not match the existing WhatsMedi identity')
      }
      if (
        whatsappUserId &&
        identity.whatsappUserId &&
        identity.whatsappUserId !== whatsappUserId
      ) {
        throw new Error('BSUID does not match the existing WhatsMedi identity')
      }
      const updated = {
        ...identity,
        phoneNumber: identity.phoneNumber || phoneNumber,
        whatsappUserId: identity.whatsappUserId || whatsappUserId,
        updatedAt: new Date().toISOString(),
      }
      this.identities.set(updated.id, updated)
      return { person, whatsappIdentity: { ...updated }, mapping: existingMapping, isNewPerson: false }
    }

    const byPhone = phoneNumber
      ? await this.findWhatsAppIdentityByPhone(input.accountId, phoneNumber)
      : null
    const byBsuid = whatsappUserId
      ? await this.findWhatsAppIdentityByWaUserId(input.accountId, whatsappUserId)
      : null
    if (byPhone && byBsuid && byPhone.id !== byBsuid.id) {
      throw new Error('BSUID and phone number belong to different WhatsMedi identities')
    }
    const existingIdentity = byBsuid ?? byPhone
    if (existingIdentity) {
      const alreadyMapped = [...this.mappings.values()].find(
        (mapping) => mapping.accountId === input.accountId && mapping.whatsappIdentityId === existingIdentity.id
      )
      if (alreadyMapped) {
        throw new Error('WhatsApp identity is already mapped to another WACRM contact')
      }
      const person = await this.findPersonById(existingIdentity.personId)
      if (!person) throw new Error('Identity is missing its Person')
      const identity = {
        ...existingIdentity,
        phoneNumber: existingIdentity.phoneNumber || phoneNumber,
        whatsappUserId: existingIdentity.whatsappUserId || whatsappUserId,
        updatedAt: new Date().toISOString(),
      }
      this.identities.set(identity.id, identity)
      const mapping = this.newMapping(input, identity)
      return { person, whatsappIdentity: { ...identity }, mapping, isNewPerson: false }
    }

    const now = new Date().toISOString()
    const person: Person = {
      id: crypto.randomUUID() as Person['id'],
      displayName: input.name?.trim() || null,
      createdAt: now,
      updatedAt: now,
    }
    const identity = {
      id: crypto.randomUUID() as import('./types').WhatsAppIdentityId,
      accountId: input.accountId,
      personId: person.id,
      phoneNumber,
      whatsappUserId,
      status: 'active' as const,
      source: input.source ?? 'whatsapp',
      createdAt: now,
      updatedAt: now,
    }
    this.persons.set(person.id, person)
    this.identities.set(identity.id, identity)
    const mapping = this.newMapping(input, identity)
    return { person: { ...person }, whatsappIdentity: { ...identity }, mapping, isNewPerson: true }
  }

  private newMapping(
    input: WacrmContactInput,
    identity: import('./types').WhatsAppIdentity
  ): WacrmContactMapping {
    const now = new Date().toISOString()
    const mapping: WacrmContactMapping = {
      id: crypto.randomUUID() as WacrmContactMapping['id'],
      accountId: input.accountId,
      wacrmContactId: input.wacrmContactId,
      personId: identity.personId,
      whatsappIdentityId: identity.id,
      createdAt: now,
      updatedAt: now,
    }
    this.mappings.set(mapping.id, mapping)
    return { ...mapping }
  }

  async findMappingByWacrmContactId(
    accountId: string,
    wacrmContactId: string
  ): Promise<WacrmContactMapping | null> {
    for (const mapping of this.mappings.values()) {
      if (mapping.accountId === accountId && mapping.wacrmContactId === wacrmContactId) {
        return { ...mapping }
      }
    }
    return null
  }

  private async findWhatsAppIdentityByPhone(
    accountId: string,
    phoneNumber: string
  ): Promise<WhatsAppIdentity | null> {
    if (!phoneNumber) return null
    for (const identity of this.identities.values()) {
      if (identity.accountId === accountId && identity.phoneNumber === phoneNumber) {
        return { ...identity }
      }
    }
    return null
  }

  private async findWhatsAppIdentityByWaUserId(
    accountId: string,
    whatsappUserId: string
  ): Promise<WhatsAppIdentity | null> {
    if (!whatsappUserId) return null
    for (const identity of this.identities.values()) {
      if (identity.accountId === accountId && identity.whatsappUserId === whatsappUserId) {
        return { ...identity }
      }
    }
    return null
  }

  async findPersonById(personId: string): Promise<Person | null> {
    const person = this.persons.get(personId)
    return person ? { ...person } : null
  }

}
