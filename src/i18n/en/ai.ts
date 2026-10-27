import type { AiProvider } from '../../ai/aiSettings';

interface ProviderText {
  label: string;
  /** Label without its parenthetical, for inline messages ("Groq", "Local"). */
  name: string;
  note: string;
}

export const ai = {
  providers: {
    groq: {
      label: 'Groq (recommended)',
      name: 'Groq',
      note: 'Free tier. Groq does not keep your requests by default; turn on Zero Data Retention in its Data Controls.',
    },
    openrouter: {
      label: 'OpenRouter',
      name: 'OpenRouter',
      note: 'Many free models. Requests only go to providers that keep nothing and never train on your notes, so some models are unavailable.',
    },
    local: {
      label: 'Local (Ollama / LM Studio)',
      name: 'Local',
      note: 'Runs on this computer; nothing leaves it. Allow this site in Ollama (OLLAMA_ORIGINS) or enable CORS in LM Studio.',
    },
    custom: {
      label: 'Custom (OpenAI-compatible)',
      name: 'Custom',
      note: 'Any OpenAI-compatible endpoint that allows browser requests. Only works when running the app locally: the published app only allows Groq, OpenRouter and models on this computer.',
    },
  } as Record<AiProvider, ProviderText>,
  localHint: 'Is Ollama / LM Studio running and allowing this site?',
  modelPlaceholder: {
    groq: '',
    openrouter: 'provider/model-name:free',
    local: 'qwen2.5:7b-instruct',
    custom: 'model name',
  } as Record<AiProvider, string>,
};
