import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  SupabaseIdentityRepository,
  SupabaseIdentityRepositoryError,
} from './supabase-repository'

const resolutionRow = {
  person_id: 'person-1',
  person_display_name: 'Jane Doe',
  person_created_at: '2026-01-01T00:00:00.000Z',
  person_updated_at: '2026-01-02T00:00:00.000Z',
  identity_id: 'identity-1',
  identity_account_id: 'account-1',
  identity_person_id: 'person-1',
  identity_phone_number: '14155550123',
  identity_whatsapp_user_id: 'US.13491208655302741918',
  identity_status: 'active' as const,
  identity_source: 'whatsapp' as const,
  identity_created_at: '2026-01-01T00:00:00.000Z',
  identity_updated_at: '2026-01-02T00:00:00.000Z',
  mapping_id: 'mapping-1',
  mapping_account_id: 'account-1',
  mapping_wacrm_contact_id: 'contact-1',
  mapping_person_id: 'person-1',
  mapping_whatsapp_identity_id: 'identity-1',
  mapping_created_at: '2026-01-01T00:00:00.000Z',
  mapping_updated_at: '2026-01-02T00:00:00.000Z',
  is_new_person: true,
}

function makeDb(result: { data: unknown; error: { message: string } | null }) {
  const calls: Array<{ name: string; args: unknown }> = []
  const builder = { single: () => Promise.resolve(result) }
  const db = {
    rpc(name: string, args: unknown) {
      calls.push({ name, args })
      return builder
    },
  } as unknown as SupabaseClient
  return { db, calls }
}

describe('SupabaseIdentityRepository', () => {
  it('uses the atomic resolver RPC and maps its single result to the domain', async () => {
    const { db, calls } = makeDb({ data: resolutionRow, error: null })
    const repository = new SupabaseIdentityRepository(db)

    await expect(
      repository.resolveFromWacrmContact({
        accountId: 'account-1',
        wacrmContactId: 'contact-1',
        phone: '+1 415 555 0123',
        phoneNormalized: '14155550123',
        waUserId: 'US.13491208655302741918',
        name: 'Jane Doe',
        source: 'whatsapp',
      })
    ).resolves.toMatchObject({
      isNewPerson: true,
      person: { id: 'person-1', displayName: 'Jane Doe' },
      whatsappIdentity: { accountId: 'account-1', phoneNumber: '14155550123' },
      mapping: { wacrmContactId: 'contact-1', whatsappIdentityId: 'identity-1' },
    })

    expect(calls).toEqual([
      {
        name: 'resolve_whatsmedi_identity',
        args: {
          p_account_id: 'account-1',
          p_wacrm_contact_id: 'contact-1',
          p_phone_number: '14155550123',
          p_whatsapp_user_id: 'US.13491208655302741918',
          p_display_name: 'Jane Doe',
          p_source: 'whatsapp',
        },
      },
    ])
  })

  it('raises a named error when the atomic resolver fails', async () => {
    const { db } = makeDb({ data: null, error: { message: 'permission denied' } })
    const repository = new SupabaseIdentityRepository(db)

    await expect(
      repository.resolveFromWacrmContact({
        accountId: 'account-1',
        wacrmContactId: 'contact-1',
        phone: '14155550123',
      })
    ).rejects.toBeInstanceOf(SupabaseIdentityRepositoryError)
  })
})
