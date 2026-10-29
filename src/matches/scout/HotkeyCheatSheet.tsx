import { Dialog } from '../../components/Dialog';
import { useT } from '../../i18n/I18nProvider';
import { HOTKEY_GROUPS, KEY_MAP } from './hotkeys';

export function HotkeyCheatSheet({ onClose }: { onClose: () => void }) {
  const t = useT().scout;
  return (
    <Dialog title={t.page.shortcuts} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {HOTKEY_GROUPS.map((group) => (
          <section key={group} aria-label={t.hotkeys.groups[group]}>
            <h3 className="mb-1 text-footnote font-semibold text-ink-2">{t.hotkeys.groups[group]}</h3>
            <dl className="flex flex-col gap-1.5">
              {KEY_MAP.filter((b) => b.group === group).map((b) => (
                <div key={b.id} className="flex items-start justify-between gap-3 text-sm">
                  <dt className="flex flex-wrap gap-1">
                    {b.keys.map((k) => (
                      <kbd key={k} className="rounded-sm bg-surface-2 px-1.5 font-sans text-xs font-medium text-ink">
                        {k}
                      </kbd>
                    ))}
                  </dt>
                  <dd className="text-right text-ink-2">{t.hotkeys.desc[b.id]}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
