import type { HealthContextActorType } from '../health-context/types'

export interface WhatsAppHealthRequest {
  accountId: string
  personId: string
  actorType: HealthContextActorType
  actorId: string | null
  message: string
  correlationId: string
}
