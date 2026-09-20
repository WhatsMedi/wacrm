import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PersonId } from '../identity/types'
import {
  SupabaseHealthContextRepository,
  SupabaseHealthContextRepositoryError,
} from './supabase-repository'

const personId = 'person-1' as PersonId

function createSupabaseMock() {
  const tables: Record<string, unknown[]> = {
    whatsmedi_health_conditions: [
      {
        id: 'condition-1',
        display_text: 'Diabetes',
        source: 'provider_entered',
        source_reference: 'provider-1',
        verification_status: 'verified',
        recorded_at: '2026-09-19T00:00:00.000Z',
      },
    ],
    whatsmedi_health_medications: [
      {
        id: 'medication-1',
        medication_name: 'Metformin',
        source: 'provider_entered',
        source_reference: 'provider-1',
        verification_status: 'verified',
        recorded_at: '2026-09-19T00:00:00.000Z',
      },
    ],
    whatsmedi_health_allergies: [],
    whatsmedi_health_observations: [
      {
        id: 'observation-1',
        observation_text: 'HbA1c',
        measured_at: '2026-09-19T00:00:00.000Z',
        source: 'provider_entered',
        source_reference: 'lab-1',
        verification_status: 'verified',
        recorded_at: '2026-09-19T00:00:00.000Z',
      },
    ],
    whatsmedi_health_encounters: [],
    whatsmedi_health_procedures: [],
    whatsmedi_health_documents: [],
    whatsmedi_health_events: [
      {
        id: 'event-1',
        event_type: 'Annual health check',
        source: 'system_recorded',
        source_reference: 'system-1',
        verification_status: 'verified',
        recorded_at: '2026-09-19T00:00:00.000Z',
      },
    ],
  }

  const queriedTables: string[] = []

  const supabase = {
    from: vi.fn((table: string) => {
      queriedTables.push(table)

      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),

        maybeSingle: vi.fn(async () => ({
          data:
            table === 'whatsmedi_person_accounts'
              ? { status: 'active' }
              : null,
          error: null,
        })),

        then: (
          resolve: (value: {
            data: unknown[]
            error: null
          }) => unknown,
          reject: (reason: unknown) => unknown,
        ) =>
          Promise.resolve({
            data: tables[table] ?? [],
            error: null,
          }).then(resolve, reject),
      }

      return query
    }),
  } as unknown as SupabaseClient

  return { supabase, queriedTables }
}

describe('SupabaseHealthContextRepository', () => {
  it('finds active person-account membership', async () => {
    const { supabase } = createSupabaseMock()
    const repository = new SupabaseHealthContextRepository(supabase)

    await expect(
      repository.getPersonAccountMembership('account-1', personId),
    ).resolves.toBe('active')
  })

  it('normalizes only the requested health domains', async () => {
    const { supabase, queriedTables } = createSupabaseMock()
    const repository = new SupabaseHealthContextRepository(supabase)

    const items = await repository.getHealthContextItems(
      'account-1',
      personId,
      'medication_action',
      'patient',
      ['condition', 'medication', 'allergy', 'observation'],
    )

    expect(items).toHaveLength(3)

    expect(items.map((item) => item.domain)).toEqual([
      'condition',
      'medication',
      'observation',
    ])

    expect(items[0]).toMatchObject({
      displayText: 'Diabetes',
      verificationStatus: 'verified',
      source: 'provider_entered',
    })

    expect(items[1]).toMatchObject({
      displayText: 'Metformin',
    })

    expect(items[2]).toMatchObject({
      displayText: 'HbA1c',
      effectiveAt: '2026-09-19T00:00:00.000Z',
    })

    expect(queriedTables).toEqual([
      'whatsmedi_health_conditions',
      'whatsmedi_health_medications',
      'whatsmedi_health_allergies',
      'whatsmedi_health_observations',
    ])

    expect(queriedTables).not.toContain('whatsmedi_health_encounters')
    expect(queriedTables).not.toContain('whatsmedi_health_procedures')
    expect(queriedTables).not.toContain('whatsmedi_health_documents')
    expect(queriedTables).not.toContain('whatsmedi_health_events')
  })

  it('wraps Supabase membership errors', async () => {
    const { supabase } = createSupabaseMock()

    supabase.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: null,
              error: new Error('database unavailable'),
            })),
          })),
        })),
      })),
    })) as never

    const repository = new SupabaseHealthContextRepository(supabase)

    await expect(
      repository.getPersonAccountMembership('account-1', personId),
    ).rejects.toBeInstanceOf(SupabaseHealthContextRepositoryError)
  })
})
