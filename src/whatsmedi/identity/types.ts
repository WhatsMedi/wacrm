import type { WhatsMediId } from '../types'

export type PersonId = WhatsMediId
export type WhatsAppIdentityId = WhatsMediId
export type ContactMappingId = WhatsMediId

export type IdentityStatus = 'active' | 'blocked' | 'unlinked'

export type IdentitySource = 'whatsapp' | 'manual' | 'import'

/**
 * The canonical human identity inside WhatsMedi.
 *
 * Person is intentionally NOT a WACRM Contact and contains
 * no clinical/health information.
 *
 * Conceptually global: can later be granted cross-account authorizations,
 * while Phase 1 keeps resolution account-scoped.
 */
export interface Person {
  id: PersonId
  displayName: string | null
  createdAt: string
  updatedAt: string
}

/**
 * A channel identity belonging to a WhatsMedi Person.
 *
 * In Phase 1, channel identities discovered within a provider account
 * are scoped to that account to guarantee zero cross-account leakage.
 *
 * NOTE: Family sharing and multiple-person-per-WhatsApp-identity are NOT
 * implemented in Phase 1 and are reserved for a future governed relationship
 * model. In Phase 1, each WhatsAppIdentity is bound strictly 1:1 to a single
 * Person within its account context.
 */
export interface WhatsAppIdentity {
  id: WhatsAppIdentityId
  accountId: string
  personId: PersonId
  phoneNumber: string
  whatsappUserId: string | null
  status: IdentityStatus
  source: IdentitySource
  createdAt: string
  updatedAt: string
}

/**
 * Explicit bridge between WACRM communication records
 * and the WhatsMedi identity layer.
 *
 * WACRM remains responsible for communication infrastructure.
 * WhatsMedi remains responsible for identity.
 */
export interface WacrmContactMapping {
  id: ContactMappingId
  accountId: string
  wacrmContactId: string
  personId: PersonId
  whatsappIdentityId: WhatsAppIdentityId
  createdAt: string
  updatedAt: string
}

/**
 * Read-only contact input provided from WACRM into the identity resolver.
 */
export interface WacrmContactInput {
  accountId: string
  wacrmContactId: string
  phone: string
  phoneNormalized?: string | null
  waUserId?: string | null
  name?: string | null
  source?: IdentitySource
}

/**
 * Output of the identity resolution workflow.
 */
export interface ResolvedIdentityContext {
  person: Person
  whatsappIdentity: WhatsAppIdentity
  mapping: WacrmContactMapping
  isNewPerson: boolean
}

