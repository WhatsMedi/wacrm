import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { createWhatsMediId } from '../types'
import type {
  IdentitySource,
  IdentityStatus,
  Person,
  WhatsAppIdentity,
  WacrmContactMapping,
  WacrmContactInput,
  ResolvedIdentityContext,
} from './types'
import type { IdentityRepository } from './repository'

type PersonRow = {
  id: string
  display_name: string | null
  created_at: string
  updated_at: string
}

type WhatsAppIdentityRow = {
  id: string
  account_id: string
  person_id: string
  phone_number: string
  whatsapp_user_id: string | null
  status: IdentityStatus
  source: IdentitySource
  created_at: string
  updated_at: string
}

type ContactMappingRow = {
  id: string
  account_id: string
  wacrm_contact_id: string
  person_id: string
  whatsapp_identity_id: string
  created_at: string
  updated_at: string
}

type ResolvedIdentityRow = {
  person_id: string
  person_display_name: string | null
  person_created_at: string
  person_updated_at: string
  identity_id: string
  identity_account_id: string
  identity_person_id: string
  identity_phone_number: string
  identity_whatsapp_user_id: string | null
  identity_status: IdentityStatus
  identity_source: IdentitySource
  identity_created_at: string
  identity_updated_at: string
  mapping_id: string
  mapping_account_id: string
  mapping_wacrm_contact_id: string
  mapping_person_id: string
  mapping_whatsapp_identity_id: string
  mapping_created_at: string
  mapping_updated_at: string
  is_new_person: boolean
}

export class SupabaseIdentityRepositoryError extends Error {
  constructor(operation: string, cause: { message: string }) {
    super(`WhatsMedi identity ${operation} failed: ${cause.message}`)
    this.name = 'SupabaseIdentityRepositoryError'
  }
}

function toPerson(row: PersonRow): Person {
  return {
    id: createWhatsMediId(row.id),
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toWhatsAppIdentity(row: WhatsAppIdentityRow): WhatsAppIdentity {
  return {
    id: createWhatsMediId(row.id),
    accountId: row.account_id,
    personId: createWhatsMediId(row.person_id),
    phoneNumber: row.phone_number,
    whatsappUserId: row.whatsapp_user_id,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toMapping(row: ContactMappingRow): WacrmContactMapping {
  return {
    id: createWhatsMediId(row.id),
    accountId: row.account_id,
    wacrmContactId: row.wacrm_contact_id,
    personId: createWhatsMediId(row.person_id),
    whatsappIdentityId: createWhatsMediId(row.whatsapp_identity_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Service-side persistence adapter for the WhatsMedi identity boundary.
 *
 * This repository deliberately requires an explicitly supplied Supabase
 * client so callers control where service-role credentials are permitted.
 */
export class SupabaseIdentityRepository implements IdentityRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async resolveFromWacrmContact(
    input: WacrmContactInput
  ): Promise<ResolvedIdentityContext> {
    const { data, error } = await this.supabase
      .rpc('resolve_whatsmedi_identity', {
        p_account_id: input.accountId,
        p_wacrm_contact_id: input.wacrmContactId,
        p_phone_number: input.phoneNormalized ?? input.phone,
        p_whatsapp_user_id: input.waUserId ?? null,
        p_display_name: input.name ?? null,
        p_source: input.source ?? 'whatsapp',
      })
      .single()

    if (error) {
      throw new SupabaseIdentityRepositoryError('resolving contact identity', error)
    }
    if (!data) throw new SupabaseIdentityRepositoryError('resolving contact identity', {
      message: 'the resolution RPC returned no row',
    })

    const row = data as ResolvedIdentityRow
    return {
      person: toPerson({
        id: row.person_id,
        display_name: row.person_display_name,
        created_at: row.person_created_at,
        updated_at: row.person_updated_at,
      }),
      whatsappIdentity: toWhatsAppIdentity({
        id: row.identity_id,
        account_id: row.identity_account_id,
        person_id: row.identity_person_id,
        phone_number: row.identity_phone_number,
        whatsapp_user_id: row.identity_whatsapp_user_id,
        status: row.identity_status,
        source: row.identity_source,
        created_at: row.identity_created_at,
        updated_at: row.identity_updated_at,
      }),
      mapping: toMapping({
        id: row.mapping_id,
        account_id: row.mapping_account_id,
        wacrm_contact_id: row.mapping_wacrm_contact_id,
        person_id: row.mapping_person_id,
        whatsapp_identity_id: row.mapping_whatsapp_identity_id,
        created_at: row.mapping_created_at,
        updated_at: row.mapping_updated_at,
      }),
      isNewPerson: row.is_new_person,
    }
  }

  async findMappingByWacrmContactId(
    accountId: string,
    wacrmContactId: string
  ): Promise<WacrmContactMapping | null> {
    const { data, error } = await this.supabase
      .from('whatsmedi_wacrm_contact_mappings')
      .select('*')
      .eq('account_id', accountId)
      .eq('wacrm_contact_id', wacrmContactId)
      .maybeSingle()

    if (error) throw new SupabaseIdentityRepositoryError('finding contact mapping', error)
    return data ? toMapping(data as ContactMappingRow) : null
  }

  async findPersonById(personId: string): Promise<Person | null> {
    const { data, error } = await this.supabase
      .from('whatsmedi_persons')
      .select('*')
      .eq('id', personId)
      .maybeSingle()

    if (error) throw new SupabaseIdentityRepositoryError('finding person', error)
    return data ? toPerson(data as PersonRow) : null
  }

}

/** Creates a service-role repository for server-only identity provisioning. */
export function createServiceRoleIdentityRepository(): SupabaseIdentityRepository {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for WhatsMedi identity persistence'
    )
  }

  return new SupabaseIdentityRepository(
    createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  )
}
