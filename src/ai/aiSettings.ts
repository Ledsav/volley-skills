export type AiProvider = 'groq' | 'openrouter' | 'local' | 'custom';

export interface AiSettings {
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** true: key persists in localStorage; false: key lives in sessionStorage only. */
  rememberKey: boolean;
}

export const AI_PROVIDERS: Record<
  AiProvider,
  { label: string; baseUrl: string; defaultModel: string; needsKey: boolean; editableUrl: boolean; note: string; keyUrl?: string }
> = {
  groq: {
    label: 'Groq (recommended)',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    needsKey: true,
    editableUrl: false,
    keyUrl: 'https://console.groq.com/keys',
    note: 'Free tier. Groq does not keep your requests by default; turn on Zero Data Retention in its Data Controls.',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: '',
    needsKey: true,
    editableUrl: false,
    keyUrl: 'https://openrouter.ai/keys',
    note: 'Many free models. Requests only go to providers that keep nothing and never train on your notes, so some models are unavailable.',
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
    note: 'Any OpenAI-compatible endpoint that allows browser requests. Only works when running the app locally: the published app only allows Groq, OpenRouter and models on this computer.',
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
  // Session-only unless the coach opts in. Settings saved before this default
  // changed keep remembering (see readAiSettings).
  rememberKey: false,
};

const SETTINGS_KEY = 'vcb.ai.settings';
const SESSION_KEY = 'vcb.ai.sessionKey';
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
    const rememberKey = v.rememberKey !== false;
    let apiKey = typeof v.apiKey === 'string' ? v.apiKey : '';
    if (!rememberKey) {
      try {
        apiKey = sessionStorage.getItem(SESSION_KEY) ?? '';
      } catch {
        apiKey = '';
      }
    }
    return {
      provider: v.provider,
      baseUrl: typeof v.baseUrl === 'string' ? v.baseUrl : AI_PROVIDERS[v.provider].baseUrl,
      apiKey,
      model: typeof v.model === 'string' ? v.model : AI_PROVIDERS[v.provider].defaultModel,
      rememberKey,
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function writeAiSettings(s: AiSettings): void {
  try {
    if (s.rememberKey) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } else {
      const { apiKey: _omit, ...rest } = s;
      void _omit;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
    }
  } catch {
    // Storage blocked (private mode): settings last for this page only.
  }
  try {
    if (s.rememberKey || !s.apiKey) sessionStorage.removeItem(SESSION_KEY);
    else sessionStorage.setItem(SESSION_KEY, s.apiKey);
  } catch {
    // Session storage blocked: the key lasts for this page only.
  }
}

/** Drops the key from localStorage and sessionStorage; provider and model stay. */
export function forgetAiKey(s: AiSettings): AiSettings {
  const next = { ...s, apiKey: '' };
  writeAiSettings(next);
  return next;
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
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Session storage blocked: nothing was stored either.
  }
}
