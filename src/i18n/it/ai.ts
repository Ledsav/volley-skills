import type { Catalog } from '../catalog';

export const ai = {
  providers: {
    groq: {
      label: 'Groq (consigliato)',
      name: 'Groq',
      note: 'Piano gratuito. Groq non conserva le tue richieste per impostazione predefinita; attiva Zero Data Retention nei suoi Data Controls.',
    },
    openrouter: {
      label: 'OpenRouter',
      name: 'OpenRouter',
      note: 'Molti modelli gratuiti. Le richieste vanno solo a fornitori che non conservano nulla e non addestrano mai sulle tue note, quindi alcuni modelli non sono disponibili.',
    },
    local: {
      label: 'Locale (Ollama / LM Studio)',
      name: 'Locale',
      note: 'Gira su questo computer; nulla ne esce. Consenti questo sito in Ollama (OLLAMA_ORIGINS) o attiva CORS in LM Studio.',
    },
    custom: {
      label: 'Personalizzato (compatibile OpenAI)',
      name: 'Personalizzato',
      note: "Qualsiasi endpoint compatibile OpenAI che accetti richieste dal browser. Funziona solo eseguendo l'app in locale: l'app pubblicata consente solo Groq, OpenRouter e i modelli su questo computer.",
    },
  },
  localHint: 'Ollama / LM Studio è in esecuzione e consente questo sito?',
  modelPlaceholder: {
    groq: '',
    openrouter: 'fornitore/nome-modello:free',
    local: 'qwen2.5:7b-instruct',
    custom: 'nome del modello',
  },
} satisfies Catalog['ai'];
