import { useState } from 'react';
import { Sheet } from '../components/Sheet';
import { Textarea } from '../components/Input';
import { useT } from '../i18n/I18nProvider';
import type { PhysicalTestGuideEntry } from '../types/physicalTestGuide';
import { LIMITS } from '../types/limits';

/** One physical test's protocol in a sheet. Done hands the edit back to the page draft; Save stays in the toolbar. */
export function PhysicalTestSheet({
  test,
  onApply,
  onClose,
}: {
  test: PhysicalTestGuideEntry;
  onApply: (test: PhysicalTestGuideEntry) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [local, setLocal] = useState(test);
  const label = t.labels.physicalTest[test.key] ?? test.label;

  return (
    <Sheet
      title={label}
      size="md"
      detent="large"
      guardUnsaved
      onClose={onClose}
      confirm={{
        label: t.components.done,
        onConfirm: () => {
          onApply(local);
          onClose();
        },
      }}
    >
      <label htmlFor={`${test.key}-protocol`} className="mb-1 block text-callout text-ink-2">
        {t.physicalTestGuide.protocol}
      </label>
      <Textarea
        id={`${test.key}-protocol`}
        maxLength={LIMITS.longText}
        value={local.protocol}
        onChange={(e) => setLocal((cur) => ({ ...cur, protocol: e.target.value }))}
        className="min-h-[160px] w-full"
      />
    </Sheet>
  );
}
