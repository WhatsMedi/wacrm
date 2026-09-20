import { describe, expect, it, vi } from 'vitest';
import { WacrmAgentModel } from './wacrm-agent-model';

const { loadAiConfigMock, generateReplyMock } = vi.hoisted(() => ({
  loadAiConfigMock: vi.fn(),
  generateReplyMock: vi.fn(),
}));

vi.mock('@/lib/ai/config', () => ({
  loadAiConfig: loadAiConfigMock,
}));

vi.mock('@/lib/ai/generate', () => ({
  generateReply: generateReplyMock,
}));

describe('WacrmAgentModel', () => {
  it('loads account-scoped AI config and delegates to WACRM generateReply', async () => {
    const config = {
      provider: 'openai' as const,
      model: 'test-model',
      apiKey: 'encrypted-decrypted-key',
      systemPrompt: null,
      isActive: true,
      autoReplyEnabled: false,
      autoReplyMaxPerConversation: 5,
      handoffAgentId: null,
      embeddingsApiKey: null,
    };

    loadAiConfigMock.mockResolvedValue(config);

    generateReplyMock.mockResolvedValue({
      text: 'Health information explained.',
      handoff: false,
      usage: null,
    });

    const db = {} as Parameters<typeof loadAiConfigMock>[0];
    const model = new WacrmAgentModel(db, 'account-1');

    const result = await model.generate({
      systemPrompt: 'You are a health information agent.',
      userMessage: 'What does my report mean?',
    });

    expect(loadAiConfigMock).toHaveBeenCalledWith(db, 'account-1');

    expect(generateReplyMock).toHaveBeenCalledWith({
      config,
      systemPrompt: 'You are a health information agent.',
      messages: [
        {
          role: 'user',
          content: 'What does my report mean?',
        },
      ],
    });

    expect(result).toEqual({
      text: 'Health information explained.',
    });
  });

  it('fails when account AI configuration is unavailable', async () => {
    loadAiConfigMock.mockResolvedValue(null);

    const db = {} as Parameters<typeof loadAiConfigMock>[0];
    const model = new WacrmAgentModel(db, 'account-1');

    await expect(
      model.generate({
        systemPrompt: 'system',
        userMessage: 'hello',
      })
    ).rejects.toThrow('AI configuration is unavailable for account account-1');

    expect(generateReplyMock).not.toHaveBeenCalled();
  });
});
