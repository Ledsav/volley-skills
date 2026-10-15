import { beforeEach, describe, expect, it } from 'vitest';
import {
  AI_PROVIDERS,
  DEFAULT_AI_SETTINGS,
  clearAiLocalData,
  draftKey,
  isAiConfigured,
  readAiSettings,
  readDraft,
  writeAiSettings,
  writeDraft,
} from './aiSettings';

describe('aiSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('defaults to Groq with its preset URL and model', () => {
    expect(readAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
    expect(DEFAULT_AI_SETTINGS.provider).toBe('groq');
    expect(DEFAULT_AI_SETTINGS.baseUrl).toBe(AI_PROVIDERS.groq.baseUrl);
  });

  it('round-trips settings through localStorage', () => {
    const s = { provider: 'local' as const, baseUrl: 'http://localhost:11434/v1', apiKey: '', model: 'qwen2.5:7b-instruct', rememberKey: true };
    writeAiSettings(s);
    expect(readAiSettings()).toEqual(s);
  });

  it('keeps the key in sessionStorage only when not remembered', () => {
    const s = { ...DEFAULT_AI_SETTINGS, apiKey: 'gsk_secret', rememberKey: false };
    writeAiSettings(s);
    expect(localStorage.getItem('vcb.ai.settings')).not.toContain('gsk_secret');
    expect(sessionStorage.getItem('vcb.ai.sessionKey')).toBe('gsk_secret');
    expect(readAiSettings()).toEqual(s);
    writeAiSettings({ ...s, rememberKey: true });
    expect(sessionStorage.getItem('vcb.ai.sessionKey')).toBeNull();
    expect(readAiSettings().apiKey).toBe('gsk_secret');
  });

  it('falls back to defaults on corrupt storage', () => {
    localStorage.setItem('vcb.ai.settings', '{not json');
    expect(readAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('ignores inherited object keys as a provider', () => {
    localStorage.setItem('vcb.ai.settings', JSON.stringify({ provider: 'constructor', baseUrl: 'x', apiKey: 'k', model: 'm' }));
    expect(readAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('needs a key unless the provider is local', () => {
    expect(isAiConfigured({ ...DEFAULT_AI_SETTINGS, apiKey: '' })).toBe(false);
    expect(isAiConfigured({ ...DEFAULT_AI_SETTINGS, apiKey: 'k' })).toBe(true);
    expect(isAiConfigured({ provider: 'local', baseUrl: 'http://localhost:11434/v1', apiKey: '', model: 'm', rememberKey: true })).toBe(true);
    expect(isAiConfigured({ provider: 'custom', baseUrl: '', apiKey: 'k', model: 'm', rememberKey: true })).toBe(false);
    expect(isAiConfigured({ ...DEFAULT_AI_SETTINGS, apiKey: 'k', model: ' ' })).toBe(false);
  });

  it('stores drafts per match and clears everything AI-related', () => {
    writeDraft('m1', '7 ace');
    writeAiSettings({ ...DEFAULT_AI_SETTINGS, apiKey: 'secret' });
    localStorage.setItem('unrelated', 'keep');
    expect(readDraft('m1')).toBe('7 ace');
    expect(draftKey('m1')).toBe('vcb.textDraft.m1');
    writeAiSettings({ ...DEFAULT_AI_SETTINGS, apiKey: 'sess', rememberKey: false });
    clearAiLocalData();
    expect(sessionStorage.getItem('vcb.ai.sessionKey')).toBeNull();
    expect(readDraft('m1')).toBe('');
    expect(readAiSettings().apiKey).toBe('');
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
});
