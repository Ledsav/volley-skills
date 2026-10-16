import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/Button';
import { SettingsSection } from './SettingsSection';
import { FIELD_CLASS, Input } from '../components/Input';
import { useNotify } from '../components/Notice';
import { AiError, testConnection } from '../ai/aiClient';
import {
  AI_PROVIDERS,
  LOCAL_UNREACHABLE_HINT,
  forgetAiKey,
  providerName,
  readAiSettings,
  writeAiSettings,
  type AiProvider,
  type AiSettings,
} from '../ai/aiSettings';

const ERROR_TEXT: Record<AiError['kind'], string> = {
  notConfigured: 'Fill in the fields above first.',
  unauthorized: 'Key rejected — check it in your provider account.',
  rateLimited: 'Rate limit reached — try again in a moment.',
  unreachable: 'Could not reach the provider.',
  badResponse: 'The model answered, but not with JSON. Try another model.',
  privacyBlocked: 'No provider for this model keeps your notes private (zero data retention). Pick another model in Settings.',
  http: 'The provider returned an error.',
};

function errorText(e: AiError, provider: AiProvider): string {
  if (e.kind === 'rateLimited') return `${providerName(provider)} rate limit reached — try again in a moment.`;
  if (e.kind === 'unreachable' && provider === 'local') return `${ERROR_TEXT.unreachable} ${LOCAL_UNREACHABLE_HINT}`;
  return ERROR_TEXT[e.kind];
}

const MODEL_PLACEHOLDER: Record<AiProvider, string> = {
  groq: '',
  openrouter: 'provider/model-name:free',
  local: 'qwen2.5:7b-instruct',
  custom: 'model name',
};

const INPUT_CLASS = 'w-full min-h-11';
const EXT_LINK_CLASS = 'text-sm text-blue hover:underline';

type Status = { kind: 'testing' | 'ok' | 'error'; text: string };

export function AiProviderSettings({ testFn = testConnection }: { testFn?: typeof testConnection }) {
  const [s, setS] = useState<AiSettings>(readAiSettings);
  const [status, setStatus] = useState<Status | null>(null);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const keyId = useId();
  const notify = useNotify();
  const preset = AI_PROVIDERS[s.provider];

  function update(next: AiSettings) {
    setS(next);
    writeAiSettings(next);
    setStatus(null);
    setSaved(true);
  }

  async function runTest() {
    setTesting(true);
    setStatus({ kind: 'testing', text: 'Testing…' });
    try {
      await testFn(s);
      setStatus({ kind: 'ok', text: 'Connected — AI features are ready.' });
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof AiError ? errorText(e, s.provider) : 'Connection failed.' });
    } finally {
      setTesting(false);
    }
  }

  const statusColor =
    status?.kind === 'ok' ? 'text-green-strong' : status?.kind === 'error' ? 'text-red' : 'text-slate';

  return (
    <SettingsSection title="AI provider" description="Used for text scouting and for drafting exercises and trainings.">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Provider
          <select
            aria-label="AI provider"
            className={`${FIELD_CLASS} min-h-11`}
            value={s.provider}
            onChange={(e) => {
              const provider = e.target.value as AiProvider;
              const p = AI_PROVIDERS[provider];
              // A key belongs to one provider: never carry it over to another.
              update({ ...s, provider, baseUrl: p.baseUrl, model: p.defaultModel, apiKey: '' });
            }}
          >
            {(Object.keys(AI_PROVIDERS) as AiProvider[]).map((id) => (
              <option key={id} value={id}>{AI_PROVIDERS[id].label}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Model
            <Input
              aria-label="Model"
              className={INPUT_CLASS}
              placeholder={MODEL_PLACEHOLDER[s.provider]}
              value={s.model}
              onChange={(e) => update({ ...s, model: e.target.value })}
            />
          </label>
          {s.provider === 'openrouter' && (
            <a
              href="https://openrouter.ai/models?max_price=0"
              target="_blank"
              rel="noopener noreferrer"
              className={EXT_LINK_CLASS}
            >
              Free models
            </a>
          )}
        </div>
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
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={keyId} className="text-sm font-medium text-ink">
                API key
              </label>
              {preset.keyUrl && (
                <a href={preset.keyUrl} target="_blank" rel="noopener noreferrer" className={EXT_LINK_CLASS}>
                  Get a key
                </a>
              )}
            </div>
            <div className="relative">
              <Input
                id={keyId}
                aria-label="API key"
                className={`${INPUT_CLASS} pr-11`}
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                value={s.apiKey}
                onChange={(e) => update({ ...s, apiKey: e.target.value })}
              />
              <button
                type="button"
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                aria-pressed={showKey}
                onClick={() => setShowKey((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate hover:text-ink"
              >
                {showKey ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={s.rememberKey}
                onChange={(e) => update({ ...s, rememberKey: e.target.checked })}
              />
              Remember on this device
            </label>
            <Button
              variant="ghost"
              size="sm"
              disabled={!s.apiKey}
              onClick={() => {
                setS(forgetAiKey(s));
                setStatus(null);
                notify('API key removed from this device.');
              }}
            >
              Forget key
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-slate">{preset.note}</p>
      {preset.needsKey && (
        <p className="text-xs text-slate">
          Use a club or work account with the provider, not a personal one, and accept its data-processing terms
          (DPA) in its console.
        </p>
      )}
      <p className="text-xs text-slate">
        Player names never leave this device — only jersey numbers, roles and the match situation are sent.{' '}
        <Link to="/privacy" className="text-blue hover:underline">
          What&apos;s sent
        </Link>
      </p>
      <p aria-live="polite" className="text-xs text-slate">
        {saved ? 'Saved on this device' : ''}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => void runTest()} disabled={testing}>
          Test connection
        </Button>
        {status && (
          <p role="status" className={`flex items-center gap-1.5 text-sm ${statusColor}`}>
            {status.kind === 'ok' && <CheckCircle2 size={16} aria-hidden="true" />}
            {status.kind === 'error' && <AlertTriangle size={16} aria-hidden="true" />}
            {status.text}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}
