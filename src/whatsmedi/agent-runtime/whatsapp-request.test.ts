import { describe, expect, it } from 'vitest'
import type { WhatsAppHealthRequest } from './whatsapp-request'

describe('WhatsAppHealthRequest', () => {
  it('represents an account-scoped WhatsApp health request', () => {
    const request: WhatsAppHealthRequest = {
      accountId: 'account-123',
      personId: 'person-123',
      actorType: 'patient',
      actorId: 'person-123',
      message: 'Explain my report',
      correlationId: 'wa-message-123',
    }

    expect(request.accountId).toBe('account-123')
    expect(request.personId).toBe('person-123')
    expect(request.actorType).toBe('patient')
    expect(request.message).toBe('Explain my report')
  })
})
