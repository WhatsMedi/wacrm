import type { SupabaseClient } from '@supabase/supabase-js'
import type { IdentityService } from '../identity/service'
import { runWhatsMediHealthInformation } from './whatsapp-health-information'
import type { WacrmContactInput } from '../identity/types'
import type { WhatsAppHealthRequest } from './whatsapp-request'

export async function handleWhatsAppHealthRequest(
  db: SupabaseClient,
  identityService: IdentityService,
  input: WacrmContactInput,
  request: Omit<WhatsAppHealthRequest, 'personId'>,
) {
  const identity = await identityService.resolveFromWacrmContact(input)

  return runWhatsMediHealthInformation({
    db,
    accountId: request.accountId,
    personId: identity.person.id,
    actorType: request.actorType,
    actorId: request.actorId,
    message: request.message,
    correlationId: request.correlationId,
  })
}

