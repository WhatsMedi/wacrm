import type {
  Person,
  WhatsAppIdentity,
  WacrmContactMapping,
  PersonId,
  WhatsAppIdentityId,
} from './types'

export interface IdentityRepository {
  // Account-scoped mapping lookups
  findMappingByWacrmContactId(
    accountId: string,
    wacrmContactId: string
  ): Promise<WacrmContactMapping | null>

  // Account-scoped channel identity lookups
  findWhatsAppIdentityByPhone(
    accountId: string,
    phoneNumber: string
  ): Promise<WhatsAppIdentity | null>

  findWhatsAppIdentityByWaUserId(
    accountId: string,
    whatsappUserId: string
  ): Promise<WhatsAppIdentity | null>

  findWhatsAppIdentityById(
    identityId: WhatsAppIdentityId
  ): Promise<WhatsAppIdentity | null>

  // Person lookups
  findPersonById(personId: PersonId): Promise<Person | null>

  // Mutations
  createPerson(
    person: Omit<Person, 'createdAt' | 'updatedAt'>
  ): Promise<Person>

  createWhatsAppIdentity(
    identity: Omit<WhatsAppIdentity, 'createdAt' | 'updatedAt'>
  ): Promise<WhatsAppIdentity>

  createMapping(
    mapping: Omit<WacrmContactMapping, 'createdAt' | 'updatedAt'>
  ): Promise<WacrmContactMapping>

  updateWhatsAppIdentity(
    id: WhatsAppIdentityId,
    patch: Partial<Omit<WhatsAppIdentity, 'id' | 'accountId' | 'personId' | 'createdAt'>>
  ): Promise<WhatsAppIdentity>
}

/**
 * Deterministic in-memory repository for test suites and isolated execution
 * without database dependencies.
 */
export class InMemoryIdentityRepository implements IdentityRepository {
  private readonly persons = new Map<string, Person>()
  private readonly identities = new Map<string, WhatsAppIdentity>()
  private readonly mappings = new Map<string, WacrmContactMapping>()

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

  async findWhatsAppIdentityByPhone(
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

  async findWhatsAppIdentityByWaUserId(
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

  async findWhatsAppIdentityById(
    identityId: WhatsAppIdentityId
  ): Promise<WhatsAppIdentity | null> {
    const identity = this.identities.get(identityId)
    return identity ? { ...identity } : null
  }

  async findPersonById(personId: PersonId): Promise<Person | null> {
    const person = this.persons.get(personId)
    return person ? { ...person } : null
  }

  async createPerson(
    person: Omit<Person, 'createdAt' | 'updatedAt'>
  ): Promise<Person> {
    const now = new Date().toISOString()
    const created: Person = {
      ...person,
      createdAt: now,
      updatedAt: now,
    }
    this.persons.set(person.id, created)
    return { ...created }
  }

  async createWhatsAppIdentity(
    identity: Omit<WhatsAppIdentity, 'createdAt' | 'updatedAt'>
  ): Promise<WhatsAppIdentity> {
    const now = new Date().toISOString()
    const created: WhatsAppIdentity = {
      ...identity,
      createdAt: now,
      updatedAt: now,
    }
    this.identities.set(identity.id, created)
    return { ...created }
  }

  async createMapping(
    mapping: Omit<WacrmContactMapping, 'createdAt' | 'updatedAt'>
  ): Promise<WacrmContactMapping> {
    const now = new Date().toISOString()
    const created: WacrmContactMapping = {
      ...mapping,
      createdAt: now,
      updatedAt: now,
    }
    this.mappings.set(mapping.id, created)
    return { ...created }
  }

  async updateWhatsAppIdentity(
    id: WhatsAppIdentityId,
    patch: Partial<Omit<WhatsAppIdentity, 'id' | 'accountId' | 'personId' | 'createdAt'>>
  ): Promise<WhatsAppIdentity> {
    const existing = this.identities.get(id)
    if (!existing) {
      throw new Error(`WhatsAppIdentity not found: ${id}`)
    }
    const updated: WhatsAppIdentity = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    this.identities.set(id, updated)
    return { ...updated }
  }
}
