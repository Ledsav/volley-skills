import { useState } from 'react';
import { Button } from '../components/Button';
import { FIELD_CLASS, Input } from '../components/Input';
import { AiError, testConnection } from '../matches/text/aiClient';
import { AI_PROVIDERS, readAiSettings, writeAiSettings, type AiProvider, type AiSettings } from '../matches/text/aiSettings';

const ERROR_TEXT: Record<AiError['kind'], string> = {
  notConfigured: 'Fill in the fields above first.',
  unauthorized: 'Key rejected — check it in your provider account.',
  rateLimited: 'Rate limit reached — try again in a moment.',
  unreachable: 'Could not reach the provider. For Local, is Ollama / LM Studio running and allowing this site?',
  badResponse: 'The model answered, but not with JSON. Try another model.',
  http: 'The provider returned an error.',
};

const INPUT_CLASS = 'w-full min-h-11';

export function AiProviderSettings({ testFn = testConnection }: { testFn?: typeof testConnection }) {
  const [s, setS] = useState<AiSettings>(readAiSettings);
  const [status, setStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const preset = AI_PROVIDERS[s.provider];

  function update(next: AiSettings) {
    setS(next);
    writeAiSettings(next);
    setStatus(null);
  }

  async function runTest() {
    setTesting(true);
    setStatus('Testing…');
    try {
      await testFn(s);
      setStatus('Connected — text scouting is ready.');
    } catch (e) {
      setStatus(e instanceof AiError ? ERROR_TEXT[e.kind] : 'Connection failed.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div>
        <p className="font-medium text-ink">Text scouting (AI)</p>
        <p className="text-sm text-slate">
          Turns typed match notes into scouting actions. Settings and key stay on this device. Only jersey numbers,
          roles, the score and your notes (with player names replaced by numbers) are sent. Keep notes to the play.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Provider
        <select
          aria-label="AI provider"
          className={`${FIELD_CLASS} min-h-11`}
          value={s.provider}
          onChange={(e) => {
            const provider = e.target.value as AiProvider;
            const p = AI_PROVIDERS[provider];
            update({ provider, baseUrl: p.baseUrl, model: p.defaultModel, apiKey: p.needsKey ? s.apiKey : '' });
          }}
        >
          {(Object.keys(AI_PROVIDERS) as AiProvider[]).map((id) => (
            <option key={id} value={id}>{AI_PROVIDERS[id].label}</option>
          ))}
        </select>
      </label>
      <p className="text-xs text-slate">{preset.note}</p>
      {preset.editableUrl && (
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Base URL
          <Input
            aria-label="Base URL"
            className={INPUT_CLASS}
            value={s.baseUrl}
            onChange={(e) => update({ ...s, baseUrl: e.target.value })}
          />
        </label>
      )}
      {preset.needsKey && (
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          API key
          <Input
            aria-label="API key"
            className={INPUT_CLASS}
            type="password"
            autoComplete="off"
            value={s.apiKey}
            onChange={(e) => update({ ...s, apiKey: e.target.value })}
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Model
        <Input
          aria-label="Model"
          className={INPUT_CLASS}
          value={s.model}
          onChange={(e) => update({ ...s, model: e.target.value })}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => void runTest()} disabled={testing}>
          Test connection
        </Button>
        {status && (
          <p role="status" className="text-sm text-ink">
            {status}
          </p>
        )}
      </div>
    </section>
  );
}
