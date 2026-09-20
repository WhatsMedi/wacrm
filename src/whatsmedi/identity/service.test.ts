import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryIdentityRepository } from './repository'
import {
  IdentityService,
  normalizePhoneNumber,
  normalizeWhatsAppUserId,
} from './service'
import type { WacrmContactInput } from './types'

describe('IdentityService', () => {
  let repo: InMemoryIdentityRepository
  let service: IdentityService

  beforeEach(() => {
    repo = new InMemoryIdentityRepository()
    service = new IdentityService(repo)
  })

  describe('Normalization', () => {
    it('phone/WhatsApp identifiers are normalized consistently', () => {
      expect(normalizePhoneNumber('+91 98765-43210')).toBe('919876543210')
      expect(normalizePhoneNumber('(555) 019-2834')).toBe('5550192834')
      expect(normalizePhoneNumber('919876543210')).toBe('919876543210')
      expect(normalizePhoneNumber('')).toBe('')
      expect(normalizePhoneNumber(null)).toBe('')
      expect(normalizePhoneNumber(undefined)).toBe('')

      expect(normalizeWhatsAppUserId('  US.13491208655302741918  ')).toBe(
        'US.13491208655302741918'
      )
      expect(normalizeWhatsAppUserId('')).toBeNull()
      expect(normalizeWhatsAppUserId('   ')).toBeNull()
      expect(normalizeWhatsAppUserId(null)).toBeNull()
    })
  })

  describe('Resolution Scenarios', () => {
    it('first contact creates Person + WhatsAppIdentity + mapping', async () => {
      const input: WacrmContactInput = {
        accountId: 'acc_clinic_alpha',
        wacrmContactId: 'wacrm_cnt_001',
        phone: '+91 98765 43210',
        name: 'Aarav Patel',
      }

      const result = await service.resolveFromWacrmContact(input)

      expect(result.isNewPerson).toBe(true)
      expect(result.person).toBeDefined()
      expect(result.person.displayName).toBe('Aarav Patel')
      expect(result.person.id).toBeTruthy()

      expect(result.whatsappIdentity).toBeDefined()
      expect(result.whatsappIdentity.accountId).toBe('acc_clinic_alpha')
      expect(result.whatsappIdentity.personId).toBe(result.person.id)
      expect(result.whatsappIdentity.phoneNumber).toBe('919876543210')
      expect(result.whatsappIdentity.status).toBe('active')

      expect(result.mapping).toBeDefined()
      expect(result.mapping.accountId).toBe('acc_clinic_alpha')
      expect(result.mapping.wacrmContactId).toBe('wacrm_cnt_001')
      expect(result.mapping.personId).toBe(result.person.id)
      expect(result.mapping.whatsappIdentityId).toBe(result.whatsappIdentity.id)
    })

    it('repeated same-account contact resolves the existing mapping', async () => {
      const input: WacrmContactInput = {
        accountId: 'acc_clinic_alpha',
        wacrmContactId: 'wacrm_cnt_001',
        phone: '+91 98765 43210',
        name: 'Aarav Patel',
      }

      const firstResolution = await service.resolveFromWacrmContact(input)
      expect(firstResolution.isNewPerson).toBe(true)

      const secondResolution = await service.resolveFromWacrmContact(input)
      expect(secondResolution.isNewPerson).toBe(false)
      expect(secondResolution.person.id).toBe(firstResolution.person.id)
      expect(secondResolution.whatsappIdentity.id).toBe(
        firstResolution.whatsappIdentity.id
      )
      expect(secondResolution.mapping.id).toBe(firstResolution.mapping.id)
    })

    it('existing account mapping remains stable', async () => {
      const input: WacrmContactInput = {
        accountId: 'acc_clinic_alpha',
        wacrmContactId: 'wacrm_cnt_001',
        phone: '+91 98765 43210',
        name: 'Aarav Patel',
      }

      const initial = await service.resolveFromWacrmContact(input)

      // Query mapping directly through helper
      const mapping = await service.getMappingByWacrmContactId(
        'acc_clinic_alpha',
        'wacrm_cnt_001'
      )
      expect(mapping).toBeDefined()
      expect(mapping?.personId).toBe(initial.person.id)
      expect(mapping?.whatsappIdentityId).toBe(initial.whatsappIdentity.id)

      // Calling resolution again with altered display name retains stable person id
      const repeated = await service.resolveFromWacrmContact({
        ...input,
        name: 'Aarav P. (Updated Display)',
      })
      expect(repeated.isNewPerson).toBe(false)
      expect(repeated.person.id).toBe(initial.person.id)
      expect(repeated.mapping.id).toBe(initial.mapping.id)
    })

    it('two different accounts do not accidentally expose or link each other\'s identity', async () => {
      const sharedPhoneNumber = '+91 98765 43210'

      // Clinic Alpha receives a message from the phone
      const alphaResult = await service.resolveFromWacrmContact({
        accountId: 'acc_clinic_alpha',
        wacrmContactId: 'wacrm_cnt_alpha_1',
        phone: sharedPhoneNumber,
        name: 'Patient Alpha',
      })
      expect(alphaResult.isNewPerson).toBe(true)
      expect(alphaResult.whatsappIdentity.accountId).toBe('acc_clinic_alpha')

      // Clinic Beta receives a message from the SAME phone number
      const betaResult = await service.resolveFromWacrmContact({
        accountId: 'acc_clinic_beta',
        wacrmContactId: 'wacrm_cnt_beta_1',
        phone: sharedPhoneNumber,
        name: 'Patient Beta',
      })

      // Must be created independently without linking to Alpha's Person or Identity
      expect(betaResult.isNewPerson).toBe(true)
      expect(betaResult.person.id).not.toBe(alphaResult.person.id)
      expect(betaResult.whatsappIdentity.id).not.toBe(
        alphaResult.whatsappIdentity.id
      )
      expect(betaResult.whatsappIdentity.accountId).toBe('acc_clinic_beta')
      expect(betaResult.mapping.accountId).toBe('acc_clinic_beta')

      // Lookups for Alpha must only return Alpha's mapping
      const alphaLookup = await service.getMappingByWacrmContactId(
        'acc_clinic_alpha',
        'wacrm_cnt_alpha_1'
      )
      expect(alphaLookup?.personId).toBe(alphaResult.person.id)

      // Cross-account lookup must yield null
      const crossLookup = await service.getMappingByWacrmContactId(
        'acc_clinic_beta',
        'wacrm_cnt_alpha_1'
      )
      expect(crossLookup).toBeNull()
    })

    it('rejects a second WACRM contact for an already mapped identity', async () => {
      await service.resolveFromWacrmContact({
        accountId: 'acc_clinic_alpha',
        wacrmContactId: 'wacrm_cnt_001',
        phone: '+91 98765 43210',
        name: 'First Record',
      })

      await expect(
        service.resolveFromWacrmContact({
          accountId: 'acc_clinic_alpha',
          wacrmContactId: 'wacrm_cnt_002',
          phone: '+91 98765 43210',
          name: 'Second Record',
        })
      ).rejects.toThrow('already mapped to another WACRM contact')
    })

    it('handles BSUID-only contact (without phone number)', async () => {
      const input: WacrmContactInput = {
        accountId: 'acc_clinic_alpha',
        wacrmContactId: 'wacrm_cnt_bsuid_only',
        phone: '',
        waUserId: 'US.13491208655302741918',
        name: 'Username User',
      }

      const result = await service.resolveFromWacrmContact(input)
      expect(result.isNewPerson).toBe(true)
      expect(result.whatsappIdentity.whatsappUserId).toBe(
        'US.13491208655302741918'
      )
      expect(result.whatsappIdentity.phoneNumber).toBe('')

      // Subsequent resolution matches by BSUID
      const repeated = await service.resolveFromWacrmContact(input)
      expect(repeated.isNewPerson).toBe(false)
      expect(repeated.person.id).toBe(result.person.id)
    })

    it('throws when required identifiers are missing', async () => {
      await expect(
        service.resolveFromWacrmContact({
          accountId: '',
          wacrmContactId: 'cnt_1',
          phone: '919876543210',
        })
      ).rejects.toThrow('accountId is required')

      await expect(
        service.resolveFromWacrmContact({
          accountId: 'acc_1',
          wacrmContactId: '',
          phone: '919876543210',
        })
      ).rejects.toThrow('wacrmContactId is required')

      await expect(
        service.resolveFromWacrmContact({
          accountId: 'acc_1',
          wacrmContactId: 'cnt_1',
          phone: '',
          waUserId: '',
        })
      ).rejects.toThrow('Contact must have either a valid phone number or WhatsApp user ID')

      await expect(
        service.resolveFromWacrmContact({
          accountId: 'acc_1',
          wacrmContactId: 'cnt_1',
          phone: '',
          waUserId: 'not-a-bsuid',
        })
      ).rejects.toThrow('valid BSUID')
    })
  })
})
