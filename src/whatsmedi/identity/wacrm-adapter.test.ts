import { describe, it, expect } from 'vitest'
import type { Contact } from '@/types'
import { toWacrmContactInput } from './wacrm-adapter'
import { InMemoryIdentityRepository } from './repository'
import { IdentityService } from './service'

describe('toWacrmContactInput', () => {
  const baseContact: Contact = {
    id: 'cnt_test_001',
    user_id: 'usr_owner_001',
    account_id: 'acc_clinic_alpha',
    phone: '+91 98765 43210',
    phone_normalized: '919876543210',
    wa_user_id: 'US.13491208655302741918',
    wa_parent_user_id: 'US.ENT.11815799212886844830',
    wa_username: 'rohansharma',
    name: 'Rohan Sharma',
    email: 'rohan@example.com',
    company: 'Acme Health',
    avatar_url: 'https://example.com/avatar.png',
    created_at: '2026-09-19T10:00:00.000Z',
    updated_at: '2026-09-19T10:00:00.000Z',
  }

  it('translates a fully-populated WACRM Contact into WacrmContactInput', () => {
    const input = toWacrmContactInput(baseContact, 'whatsapp')

    expect(input).toEqual({
      accountId: 'acc_clinic_alpha',
      wacrmContactId: 'cnt_test_001',
      phone: '+91 98765 43210',
      phoneNormalized: '919876543210',
      waUserId: 'US.13491208655302741918',
      name: 'Rohan Sharma',
      source: 'whatsapp',
    })
  })

  it('translates contact with missing/undefined optional fields safely to null', () => {
    const minimalContact: Contact = {
      id: 'cnt_minimal_002',
      user_id: 'usr_owner_001',
      account_id: 'acc_clinic_alpha',
      phone: '+91 98765 00000',
      created_at: '2026-09-19T10:00:00.000Z',
      updated_at: '2026-09-19T10:00:00.000Z',
    }

    const input = toWacrmContactInput(minimalContact, 'manual')

    expect(input).toEqual({
      accountId: 'acc_clinic_alpha',
      wacrmContactId: 'cnt_minimal_002',
      phone: '+91 98765 00000',
      phoneNormalized: null,
      waUserId: null,
      name: null,
      source: 'manual',
    })
  })

  it('translates a BSUID-only contact (empty phone string, wa_user_id present)', () => {
    const bsuidContact: Contact = {
      id: 'cnt_bsuid_003',
      user_id: 'usr_owner_001',
      account_id: 'acc_clinic_alpha',
      phone: '',
      wa_user_id: 'US.998877665544332211',
      wa_username: 'patient_bsuid',
      name: 'BSUID Patient',
      created_at: '2026-09-19T10:00:00.000Z',
      updated_at: '2026-09-19T10:00:00.000Z',
    }

    const input = toWacrmContactInput(bsuidContact, 'whatsapp')

    expect(input).toEqual({
      accountId: 'acc_clinic_alpha',
      wacrmContactId: 'cnt_bsuid_003',
      phone: '',
      phoneNormalized: null,
      waUserId: 'US.998877665544332211',
      name: 'BSUID Patient',
      source: 'whatsapp',
    })
  })

  it('preserves provenance for different sources (import, manual, whatsapp)', () => {
    const importInput = toWacrmContactInput(baseContact, 'import')
    expect(importInput.source).toBe('import')

    const manualInput = toWacrmContactInput(baseContact, 'manual')
    expect(manualInput.source).toBe('manual')

    const whatsappInput = toWacrmContactInput(baseContact, 'whatsapp')
    expect(whatsappInput.source).toBe('whatsapp')
  })

  it('integrates cleanly with IdentityService.resolveFromWacrmContact', async () => {
    const repo = new InMemoryIdentityRepository()
    const service = new IdentityService(repo)

    const input = toWacrmContactInput(baseContact, 'whatsapp')
    const result = await service.resolveFromWacrmContact(input)

    expect(result.isNewPerson).toBe(true)
    expect(result.person.displayName).toBe('Rohan Sharma')
    expect(result.whatsappIdentity.phoneNumber).toBe('919876543210')
    expect(result.whatsappIdentity.whatsappUserId).toBe(
      'US.13491208655302741918'
    )
    expect(result.mapping.accountId).toBe('acc_clinic_alpha')
    expect(result.mapping.wacrmContactId).toBe('cnt_test_001')
  })
})
