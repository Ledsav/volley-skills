import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import type { Catalog } from '../i18n/catalog';
import { useT } from '../i18n/I18nProvider';
import { Button } from '../components/Button';
import { Field, FieldLabel, Input } from '../components/Input';
import { Select } from '../components/Select';
import { SwitchRow } from '../components/Switch';
import { useNotify } from '../components/Notice';
import { AiError, testConnection } from '../ai/aiClient';
import {
  AI_PROVIDERS,
  forgetAiKey,
  providerName,
  readAiSettings,
  writeAiSettings,
  type AiProvider,
  type AiSettings,
} from '../ai/aiSettings';

function errorText(e: AiError, provider: AiProvider, t: Catalog['settings']['ai'], hint: string): string {
  if (e.kind === 'rateLimited') return t.rateLimitedFor(providerName(provider));
  if (e.kind === 'unreachable' && provider === 'local') return `${t.errors.unreachable} ${hint}`;
  return t.errors[e.kind];
}

const INPUT_CLASS = 'w-full min-h-11';
const EXT_LINK_CLASS = 'text-callout text-ink underline';

type Status = { kind: 'testing' | 'ok' | 'error'; text: string };

export function AiProviderSettings({ testFn = testConnection }: { testFn?: typeof testConnection }) {
  const [s, setS] = useState<AiSettings>(readAiSettings);
  const [status, setStatus] = useState<Status | null>(null);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const keyId = useId();
  const notify = useNotify();
  const catalog = useT();
  const t = catalog.settings.ai;
  const ait = catalog.ai;
  const preset = AI_PROVIDERS[s.provider];

  function update(next: AiSettings) {
    setS(next);
    writeAiSettings(next);
    setStatus(null);
    setSaved(true);
  }

  async function runTest() {
    setTesting(true);
    setStatus({ kind: 'testing', text: t.testing });
    try {
      await testFn(s);
      setStatus({ kind: 'ok', text: t.connected });
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof AiError ? errorText(e, s.provider, t, ait.localHint) : t.connectionFailed });
    } finally {
      setTesting(false);
    }
  }

  const statusColor =
    status?.kind === 'ok' ? 'text-green-strong' : status?.kind === 'error' ? 'text-red-strong' : 'text-ink-2';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-card">
        <Field label={t.provider}>
          <Select
            aria-label={t.providerAria}
            className={INPUT_CLASS}
            value={s.provider}
            onChange={(e) => {
              const provider = e.target.value as AiProvider;
              const p = AI_PROVIDERS[provider];
              // A key belongs to one provider: never carry it over to another.
              update({ ...s, provider, baseUrl: p.baseUrl, model: p.defaultModel, apiKey: '' });
            }}
          >
            {(Object.keys(AI_PROVIDERS) as AiProvider[]).map((id) => (
              <option key={id} value={id}>{ait.providers[id].label}</option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-col">
          <Field label={t.model}>
            <Input
              aria-label={t.model}
              className={INPUT_CLASS}
              placeholder={ait.modelPlaceholder[s.provider]}
              value={s.model}
              onChange={(e) => update({ ...s, model: e.target.value })}
            />
          </Field>
          {s.provider === 'openrouter' && (
            <a
              href="https://openrouter.ai/models?max_price=0"
              target="_blank"
              rel="noopener noreferrer"
              className={`${EXT_LINK_CLASS} mt-1.5 self-start`}
            >
              {t.freeModels}
            </a>
          )}
        </div>
        {preset.editableUrl && (
          <Field label={t.baseUrl}>
            <Input
              aria-label={t.baseUrl}
              className={INPUT_CLASS}
              value={s.baseUrl}
              onChange={(e) => update({ ...s, baseUrl: e.target.value })}
            />
          </Field>
        )}
        {preset.needsKey && (
          <>
            <div className="flex flex-col">
              <div className="flex items-baseline justify-between gap-2">
                <FieldLabel htmlFor={keyId}>{t.apiKey}</FieldLabel>
                {preset.keyUrl && (
                  <a href={preset.keyUrl} target="_blank" rel="noopener noreferrer" className={EXT_LINK_CLASS}>
                    {t.getKey}
                  </a>
                )}
              </div>
              <div className="relative">
                <Input
                  id={keyId}
                  aria-label={t.apiKey}
                  className={`${INPUT_CLASS} pr-11`}
                  type={showKey ? 'text' : 'password'}
                  autoComplete="off"
                  value={s.apiKey}
                  onChange={(e) => update({ ...s, apiKey: e.target.value })}
                />
                <button
                  type="button"
                  aria-label={showKey ? t.hideKey : t.showKey}
                  aria-pressed={showKey}
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-2 hover:text-ink"
                >
                  {showKey ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>
            <SwitchRow
              label={t.remember}
              checked={s.rememberKey}
              onChange={(rememberKey) => update({ ...s, rememberKey })}
            />
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => void runTest()} disabled={testing}>
          {t.test}
        </Button>
        {preset.needsKey && (
          <Button
            variant="dangerGhost"
            size="sm"
            disabled={!s.apiKey}
            onClick={() => {
              setS(forgetAiKey(s));
              setStatus(null);
              notify(t.keyRemoved);
            }}
          >
            {t.forgetKey}
          </Button>
        )}
        {status && (
          <p role="status" className={`flex basis-full items-center gap-1.5 text-callout sm:basis-auto ${statusColor}`}>
            {status.kind === 'ok' && <CheckCircle2 size={16} aria-hidden="true" />}
            {status.kind === 'error' && <AlertTriangle size={16} aria-hidden="true" />}
            {status.text}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 text-footnote text-ink-2">
        <p>{ait.providers[s.provider].note}</p>
        {preset.needsKey && <p>{t.dpa}</p>}
        <p>{t.ownKey}</p>
        <p>
          {t.privacy}{' '}
          <Link to="/privacy" className="text-ink underline">
            {t.whatsSent}
          </Link>
        </p>
        <p aria-live="polite">{saved ? t.saved : ''}</p>
      </div>
    </div>
  );
}
