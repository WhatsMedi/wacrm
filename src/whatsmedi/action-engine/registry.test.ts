import { describe, expect, it } from 'vitest'
import type {
  HealthcareActionExecutor,
} from './registry'
import { InMemoryHealthcareActionRegistry } from './registry'

const makeExecutor = (
  actionType: HealthcareActionExecutor['actionType'],
): HealthcareActionExecutor => ({
  actionType,

  async execute(request) {
    return {
      action: {
        id: 'action-1',
        accountId: request.accountId,
        personId: request.personId,
        actorType: request.actorType,
        actorId: request.actorId,
        actionType: request.actionType,
        status: 'completed',
        correlationId: request.correlationId,
        idempotencyKey: request.idempotencyKey,
        payload: request.payload,
        createdAt: '2026-09-20T13:00:00.000Z',
        updatedAt: '2026-09-20T13:00:00.000Z',
      },
      message: 'Test execution',
      referenceId: 'ref-1',
    }
  },
})

describe('InMemoryHealthcareActionRegistry', () => {
  it('registers and resolves an executor', () => {
    const registry = new InMemoryHealthcareActionRegistry()
    const executor = makeExecutor('provider.search')

    registry.register(executor)

    expect(registry.get('provider.search')).toBe(executor)
  })

  it('returns null for an unknown action', () => {
    const registry = new InMemoryHealthcareActionRegistry()

    expect(registry.get('appointment.create')).toBeNull()
  })

  it('lists registered executors', () => {
    const registry = new InMemoryHealthcareActionRegistry()

    const providerSearch = makeExecutor('provider.search')
    const appointmentCreate = makeExecutor('appointment.create')

    registry.register(providerSearch)
    registry.register(appointmentCreate)

    expect(registry.list()).toEqual([
      providerSearch,
      appointmentCreate,
    ])
  })

  it('replaces an executor for the same action type', () => {
    const registry = new InMemoryHealthcareActionRegistry()

    const first = makeExecutor('provider.search')
    const second = makeExecutor('provider.search')

    registry.register(first)
    registry.register(second)

    expect(registry.get('provider.search')).toBe(second)
    expect(registry.list()).toEqual([second])
  })
})
