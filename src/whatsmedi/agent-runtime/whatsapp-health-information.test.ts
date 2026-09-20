import { describe, expect, it, vi } from 'vitest'

const executeMock = vi.hoisted(() => vi.fn())

vi.mock('./runtime', () => ({
  AgentRuntime: class {
    constructor() {}
    execute = executeMock
  },
}))

vi.mock('./capability-gate', () => ({
  AgentCapabilityGate: class {},
}))

vi.mock('./audit', () => ({
  InMemoryAgentAuditSink: class {},
}))

vi.mock('../health-context/supabase-repository', () => ({
  SupabaseHealthContextRepository: class {},
}))

vi.mock('../health-context/access-policy', () => ({
  HealthContextAccessPolicy: class {},
}))

vi.mock('../health-context/authorization-policy', () => ({
  HealthContextAuthorizationPolicy: class {},
}))

vi.mock('../health-context/service', () => ({
  HealthContextService: class {},
}))

vi.mock('./health-information-executor', () => ({
  HealthInformationAgentExecutor: class {},
}))

vi.mock('./wacrm-agent-model', () => ({
  WacrmAgentModel: class {},
}))

describe('runWhatsMediHealthInformation', () => {
  it('builds an authorized health-information AgentRequest', async () => {
    executeMock.mockResolvedValue({
      status: 'completed',
      message: 'Test response',
      correlationId: 'corr-123',
      agentId: 'health-information',
      startedAt: '2026-09-20T00:00:00.000Z',
      completedAt: '2026-09-20T00:00:01.000Z',
      actions: [],
    })

    const { runWhatsMediHealthInformation } = await import(
      './whatsapp-health-information'
    )

    const db = {} as never

    const result = await runWhatsMediHealthInformation({
      db,
      accountId: 'account-123',
      personId: 'person-123',
      actorType: 'patient',
      actorId: 'person-123',
      message: 'Please explain my health information.',
      correlationId: 'corr-123',
    })

    expect(result.status).toBe('completed')
    expect(executeMock).toHaveBeenCalledTimes(1)

    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-123',
        personId: 'person-123',
        actorType: 'patient',
        actorId: 'person-123',
        purpose: 'clinical_conversation',
        message: 'Please explain my health information.',
        agentId: 'health-information',
        requestedCapability: 'health_information.explain',
        correlationId: 'corr-123',
      }),
    )
  })
})

