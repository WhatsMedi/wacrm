import type { Contact } from '@/types'
import type { IdentitySource, WacrmContactInput } from './types'

/**
 * Pure translation adapter that maps a canonical WACRM Contact record
 * into a WhatsMedi WacrmContactInput structure for identity resolution.
 *
 * Preserves core WACRM identifiers without modifying or augmenting
 * unrelated fields.
 */
export function toWacrmContactInput(
  contact: Contact,
  source: IdentitySource
): WacrmContactInput {
  return {
    accountId: contact.account_id,
    wacrmContactId: contact.id,
    phone: contact.phone,
    phoneNormalized: contact.phone_normalized ?? null,
    waUserId: contact.wa_user_id ?? null,
    name: contact.name ?? null,
    source,
  }
}
