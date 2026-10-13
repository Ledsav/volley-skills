export type AiProvider = 'groq' | 'openrouter' | 'local' | 'custom';

export interface AiSettings {
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const AI_PROVIDERS: Record<
  AiProvider,
  { label: string; baseUrl: string; defaultModel: string; needsKey: boolean; editableUrl: boolean; note: string }
> = {
  groq: {
    label: 'Groq (recommended)',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    needsKey: true,
    editableUrl: false,
    note: 'Free tier. Groq does not keep your requests by default; turn on Zero Data Retention in its Data Controls.',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: '',
    needsKey: true,
    editableUrl: false,
    note: 'Many free models. How data is handled depends on the provider behind the model you pick.',
  },
  local: {
    label: 'Local (Ollama / LM Studio)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5:7b-instruct',
    needsKey: false,
    editableUrl: true,
    note: 'Runs on this computer; nothing leaves it. Allow this site in Ollama (OLLAMA_ORIGINS) or enable CORS in LM Studio.',
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    baseUrl: '',
    defaultModel: '',
    needsKey: true,
    editableUrl: true,
    note: 'Any OpenAI-compatible endpoint that allows browser requests.',
  },
};

/** Provider label without its parenthetical, for inline messages ("Groq", "Local"). */
export function providerName(provider: AiProvider): string {
  return AI_PROVIDERS[provider].label.replace(/\s*\(.*\)$/, '');
}

export const LOCAL_UNREACHABLE_HINT = 'Is Ollama / LM Studio running and allowing this site?';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'groq',
  baseUrl: AI_PROVIDERS.groq.baseUrl,
  apiKey: '',
  model: AI_PROVIDERS.groq.defaultModel,
};

const SETTINGS_KEY = 'vcb.ai.settings';
const DRAFT_PREFIX = 'vcb.textDraft.';

function isProvider(v: unknown): v is AiProvider {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(AI_PROVIDERS, v);
}

export function readAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    const v = JSON.parse(raw) as Partial<AiSettings>;
    if (!isProvider(v.provider)) return DEFAULT_AI_SETTINGS;
    return {
      provider: v.provider,
      baseUrl: typeof v.baseUrl === 'string' ? v.baseUrl : AI_PROVIDERS[v.provider].baseUrl,
      apiKey: typeof v.apiKey === 'string' ? v.apiKey : '',
      model: typeof v.model === 'string' ? v.model : AI_PROVIDERS[v.provider].defaultModel,
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function writeAiSettings(s: AiSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Storage blocked (private mode): settings last for this page only.
  }
}

export function isAiConfigured(s: AiSettings): boolean {
  if (!s.baseUrl.trim() || !s.model.trim()) return false;
  return !AI_PROVIDERS[s.provider].needsKey || s.apiKey.trim().length > 0;
}

export function draftKey(matchId: string): string {
  return `${DRAFT_PREFIX}${matchId}`;
}

export function readDraft(matchId: string): string {
  try {
    return localStorage.getItem(draftKey(matchId)) ?? '';
  } catch {
    return '';
  }
}

export function writeDraft(matchId: string, text: string): void {
  try {
    if (text) localStorage.setItem(draftKey(matchId), text);
    else localStorage.removeItem(draftKey(matchId));
  } catch {
    // Ignore: the draft simply isn't persisted.
  }
}

/** Removes the API key, provider settings and every text draft from this device. */
export function clearAiLocalData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === SETTINGS_KEY || k.startsWith(DRAFT_PREFIX))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage blocked: nothing was stored either.
  }
}
