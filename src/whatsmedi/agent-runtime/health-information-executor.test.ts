import { createWhatsMediId } from '../types';

import { describe, expect, it, vi } from 'vitest';

import { HealthInformationAgentExecutor } from './health-information-executor';

import type { AgentExecutionContext } from './types';

import type { AgentModel } from './model';

function createContext(
  healthContext: AgentExecutionContext['healthContext']
): AgentExecutionContext {
  return {
    request: {
      accountId: 'account-1',
      personId: createWhatsMediId('person-1'),
      actorType: 'patient',
      actorId: 'person-1',
      purpose: 'clinical_conversation',
      message: 'What does my health information mean?',
      agentId: 'health-information',
      requestedCapability: 'health_information.explain',
      correlationId: 'corr-1',
    },
    agent: {
      id: 'health-information',
      name: 'Health Information Agent',
      description: 'Explains authorized health information',
      version: '1.0.0',
      capabilities: ['health_information.explain'],
      allowedPurposes: ['clinical_conversation'],
      enabled: true,
    },
    healthContext,
    startedAt: '2026-09-20T10:00:00.000Z',
  };
}

describe('HealthInformationAgentExecutor', () => {
  it('blocks execution when health context is missing', async () => {
    const model: AgentModel = {
      generate: vi.fn(),
    };

    const executor = new HealthInformationAgentExecutor(
      model,
      () => '2026-09-20T10:00:01.000Z'
    );

    const result = await executor.execute(createContext(null));

    expect(result.status).toBe('blocked');
    expect(result.message).toContain('Health context is required');
    expect(model.generate).not.toHaveBeenCalled();
    expect(result.completedAt).toBe('2026-09-20T10:00:01.000Z');
  });

  it('passes only the authorized health context to the model', async () => {
    const model: AgentModel = {
      generate: vi.fn().mockResolvedValue({
        text: 'Your recorded information shows an observation that needs interpretation.',
      }),
    };

    const healthContext = {
      accountId: 'account-1',
      personId: createWhatsMediId('person-1'),
      generatedAt: '2026-09-20T10:00:00.000Z',
      purpose: 'clinical_conversation' as const,
      items: [
        {
          domain: 'observation' as const,
          id: 'obs-1',
          displayText: 'Blood pressure: 130/80',
          verificationStatus: 'verified' as const,
          source: 'provider_entered' as const,
          sourceReference: 'record-1',
          recordedAt: '2026-09-19T10:00:00.000Z',
          effectiveAt: '2026-09-19T10:00:00.000Z',
        },
      ],
    };

    const executor = new HealthInformationAgentExecutor(
      model,
      () => '2026-09-20T10:00:01.000Z'
    );

    const result = await executor.execute(createContext(healthContext));

    expect(result.status).toBe('completed');
    expect(result.message).toBe(
      'Your recorded information shows an observation that needs interpretation.'
    );

    expect(model.generate).toHaveBeenCalledOnce();

    const request = vi.mocked(model.generate).mock.calls[0][0];

    expect(request.userMessage).toBe('What does my health information mean?');
    expect(request.systemPrompt).toContain(JSON.stringify(healthContext));
    expect(request.systemPrompt).toContain('Do not invent clinical facts.');
    expect(request.systemPrompt).toContain('Do not diagnose or prescribe.');

    expect(result.completedAt).toBe('2026-09-20T10:00:01.000Z');
    expect(result.correlationId).toBe('corr-1');
    expect(result.agentId).toBe('health-information');
  });

  it('propagates model failures to the runtime boundary', async () => {
    const modelError = new Error('model unavailable');

    const model: AgentModel = {
      generate: vi.fn().mockRejectedValue(modelError),
    };

    const executor = new HealthInformationAgentExecutor(
      model,
      () => '2026-09-20T10:00:01.000Z'
    );

    await expect(
      executor.execute(
        createContext({
          accountId: 'account-1',
          personId: createWhatsMediId('person-1'),
          generatedAt: '2026-09-20T10:00:00.000Z',
          purpose: 'clinical_conversation',
          items: [],
        })
      )
    ).rejects.toThrow('model unavailable');
  });
});
