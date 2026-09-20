import { describe, expect, it, vi } from 'vitest'

const resolveFromWacrmContact = vi.fn()
const runWhatsMediHealthInformation = vi.fn()

vi.mock('../identity/service', () => ({
  IdentityService: class {},
}))

vi.mock('./whatsapp-health-information', () => ({
  runWhatsMediHealthInformation,
}))

describe('handleWhatsAppHealthRequest', () => {
  it('resolves the WACRM contact to a WhatsMedi person before execution', async () => {
    resolveFromWacrmContact.mockResolvedValue({
      person: {
        id: 'person-456',
      },
    })

    runWhatsMediHealthInformation.mockResolvedValue({
      status: 'completed',
      message: 'ok',
    })

    const { handleWhatsAppHealthRequest } = await import(
      './whatsapp-health-adapter'
    )

    const identityService = {
      resolveFromWacrmContact,
    } as never

    const db = {} as never

    const result = await handleWhatsAppHealthRequest(
      db,
      identityService,
      {
        accountId: 'account-123',
        wacrmContactId: 'contact-789',
        phone: '+919999999999',
        phoneNormalized: '+919999999999',
        waUserId: 'wa-user-789',
        name: 'Test User',
        source: 'whatsapp',
      },
      {
        accountId: 'account-123',
        actorType: 'patient',
        actorId: 'person-456',
        message: 'Explain my report',
        correlationId: 'wa-msg-001',
      },
    )

    expect(resolveFromWacrmContact).toHaveBeenCalledWith({
      accountId: 'account-123',
      wacrmContactId: 'contact-789',
      phone: '+919999999999',
      phoneNormalized: '+919999999999',
      waUserId: 'wa-user-789',
      name: 'Test User',
      source: 'whatsapp',
    })

    expect(runWhatsMediHealthInformation).toHaveBeenCalledWith({
      db,
      accountId: 'account-123',
      personId: 'person-456',
      actorType: 'patient',
      actorId: 'person-456',
      message: 'Explain my report',
      correlationId: 'wa-msg-001',
    })

    expect(result.status).toBe('completed')
  })
})
