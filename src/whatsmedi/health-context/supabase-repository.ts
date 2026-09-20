import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { PersonId } from '../identity/types'
import type { HealthContextRepository } from './repository'
import type {
  HealthContextActorType,
  HealthContextItem,
  HealthContextPurpose,
} from './types'
import type { HealthContextDomain } from './access-policy'

type HealthSource =
  | 'self_reported'
  | 'provider_entered'
  | 'imported'
  | 'document_extracted'
  | 'system_recorded'
  | 'ai_suggested'

type VerificationStatus =
  | 'unverified'
  | 'verified'
  | 'rejected'
  | 'superseded'

interface HealthRecordRow {
  id: string
  display_text?: string | null
  medication_name?: string | null
  allergen?: string | null
  observation_text?: string | null
  encounter_type?: string | null
  procedure_name?: string | null
  document_type?: string | null
  event_type?: string | null
  source: HealthSource
  source_reference: string | null
  verification_status: VerificationStatus
  recorded_at: string
  measured_at?: string | null
  occurred_at?: string | null
  document_date?: string | null
  start_date?: string | null
}

type HealthDomainTable =
  | 'whatsmedi_health_conditions'
  | 'whatsmedi_health_medications'
  | 'whatsmedi_health_allergies'
  | 'whatsmedi_health_observations'
  | 'whatsmedi_health_encounters'
  | 'whatsmedi_health_procedures'
  | 'whatsmedi_health_documents'
  | 'whatsmedi_health_events'

const DOMAIN_CONFIG: Record<
  HealthContextDomain,
  {
    table: HealthDomainTable
    select: string
  }
> = {
  condition: {
    table: 'whatsmedi_health_conditions',
    select:
      'id,display_text,source,source_reference,verification_status,recorded_at',
  },
  medication: {
    table: 'whatsmedi_health_medications',
    select:
      'id,medication_name,source,source_reference,verification_status,recorded_at',
  },
  allergy: {
    table: 'whatsmedi_health_allergies',
    select:
      'id,allergen,source,source_reference,verification_status,recorded_at',
  },
  observation: {
    table: 'whatsmedi_health_observations',
    select:
      'id,observation_text,measured_at,source,source_reference,verification_status,recorded_at',
  },
  encounter: {
    table: 'whatsmedi_health_encounters',
    select:
      'id,encounter_type,occurred_at,source,source_reference,verification_status,recorded_at',
  },
  procedure: {
    table: 'whatsmedi_health_procedures',
    select:
      'id,procedure_name,occurred_at,source,source_reference,verification_status,recorded_at',
  },
  document: {
    table: 'whatsmedi_health_documents',
    select:
      'id,document_type,document_date,source,source_reference,verification_status,recorded_at',
  },
  event: {
    table: 'whatsmedi_health_events',
    select:
      'id,event_type,start_date,source,source_reference,verification_status,recorded_at',
  },
}

export class SupabaseHealthContextRepositoryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'SupabaseHealthContextRepositoryError'
  }
}

export class SupabaseHealthContextRepository
  implements HealthContextRepository
{
  constructor(private readonly supabase: SupabaseClient) {}

  async getPersonAccountMembership(
    accountId: string,
    personId: PersonId,
  ): Promise<'active' | 'inactive' | null> {
    const { data, error } = await this.supabase
      .from('whatsmedi_person_accounts')
      .select('status')
      .eq('account_id', accountId)
      .eq('person_id', personId)
      .maybeSingle()

    if (error) {
      throw new SupabaseHealthContextRepositoryError(
        'finding person account membership',
        error,
      )
    }

    if (!data) return null

    return data.status === 'active' ? 'active' : 'inactive'
  }

  async getHealthContextItems(
    accountId: string,
    personId: PersonId,
    purpose: HealthContextPurpose,
    actorType: HealthContextActorType,
    allowedDomains: readonly HealthContextDomain[],
  ): Promise<HealthContextItem[]> {
    void purpose
    void actorType

    const results = await Promise.all(
      allowedDomains.map((domain) =>
        this.getRows(
          DOMAIN_CONFIG[domain].table,
          DOMAIN_CONFIG[domain].select,
          accountId,
          personId,
          domain,
        ),
      ),
    )

    return results.flat()
  }

  private async getRows(
    table: HealthDomainTable,
    select: string,
    accountId: string,
    personId: PersonId,
    domain: HealthContextDomain,
  ): Promise<HealthContextItem[]> {
    const { data, error } = await this.supabase
      .from(table)
      .select(select)
      .eq('account_id', accountId)
      .eq('person_id', personId)

    if (error) {
      throw new SupabaseHealthContextRepositoryError(
        `reading ${table}`,
        error,
      )
    }

    return ((data ?? []) as HealthRecordRow[]).map((row) =>
      this.toContextItem(row, domain),
    )
  }

  private toContextItem(
    row: HealthRecordRow,
    domain: HealthContextDomain,
  ): HealthContextItem {
    const displayText =
      row.display_text ??
      row.medication_name ??
      row.allergen ??
      row.observation_text ??
      row.encounter_type ??
      row.procedure_name ??
      row.document_type ??
      row.event_type ??
      'Health record'

    const effectiveAt =
      row.measured_at ??
      row.occurred_at ??
      row.document_date ??
      row.start_date ??
      null

    return {
      domain,
      id: row.id,
      displayText,
      verificationStatus: row.verification_status,
      source: row.source,
      sourceReference: row.source_reference,
      recordedAt: row.recorded_at,
      effectiveAt,
    }
  }
}

/** Creates a server-only service-role repository. */
export function createServiceRoleHealthContextRepository(): SupabaseHealthContextRepository {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for WhatsMedi health context access',
    )
  }

  return new SupabaseHealthContextRepository(
    createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }),
  )
}
