import { useT } from '../i18n/I18nProvider';

/** Reminder under free-text fields; the caller links it to the field with aria-describedby. */
export function HealthHint({ id }: { id?: string }) {
  const t = useT().components;
  return (
    <p id={id} className="mt-1 text-caption text-ink-2">
      {t.healthHint}
    </p>
  );
}
