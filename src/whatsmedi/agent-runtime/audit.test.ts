import { describe, expect, it } from 'vitest'
import type { AgentAuditEvent } from './audit'
import { InMemoryAgentAuditSink } from './audit'

const makeEvent = (
  overrides: Partial<AgentAuditEvent> = {},
): AgentAuditEvent => ({
  metadata: {
    correlationId: 'correlation-1',
    agentId: 'test-agent',
    agentVersion: '1.0.0',
    actorType: 'patient',
    actorId: 'person-1',
    purpose: 'clinical_conversation',
    startedAt: '2026-09-20T13:00:00.000Z',
    completedAt: '2026-09-20T13:00:01.000Z',
  },
  status: 'needs_input',
  message: 'Execution boundary reached',
  actions: [],
  ...overrides,
})

describe('InMemoryAgentAuditSink', () => {
  it('records an audit event', async () => {
    const sink = new InMemoryAgentAuditSink()
    const event = makeEvent()

    await sink.record(event)

    expect(sink.getEvents()).toEqual([event])
  })

  it('preserves event order', async () => {
    const sink = new InMemoryAgentAuditSink()
    const first = makeEvent({
      metadata: {
        ...makeEvent().metadata,
        correlationId: 'first',
      },
    })
    const second = makeEvent({
      metadata: {
        ...makeEvent().metadata,
        correlationId: 'second',
      },
    })

    await sink.record(first)
    await sink.record(second)

    expect(
      sink.getEvents().map((event) => event.metadata.correlationId),
    ).toEqual(['first', 'second'])
  })

  it('returns a copy of the stored events', async () => {
    const sink = new InMemoryAgentAuditSink()
    const event = makeEvent()

    await sink.record(event)

    const events = sink.getEvents()

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(event)
    expect(events).not.toBe(sink.getEvents())
  })

  it('records blocked executions as audit events', async () => {
    const sink = new InMemoryAgentAuditSink()
    const event = makeEvent({
      status: 'blocked',
      message: 'Agent does not have this capability',
    })

    await sink.record(event)

    expect(sink.getEvents()[0]).toMatchObject({
      status: 'blocked',
      message: 'Agent does not have this capability',
    })
  })
})
