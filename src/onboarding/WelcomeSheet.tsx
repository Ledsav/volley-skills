import { useEffect, useRef, useState } from 'react';
import { Activity, CalendarDays, Dumbbell, Eye, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Sheet, useSheetClose } from '../components/Sheet';
import { useT } from '../i18n/I18nProvider';
import { clubInitials } from '../layout/clubInitials';
import { welcomeRows, type WelcomeRowId } from './steps';

const ICONS: Record<WelcomeRowId, LucideIcon> = {
  teams: Users,
  coaches: UserPlus,
  sessions: CalendarDays,
  scouting: Activity,
  library: Dumbbell,
  view: Eye,
};

function ContinueButton({ label }: { label: string }) {
  const close = useSheetClose();
  const ref = useRef<HTMLButtonElement>(null);
  // The sheet focuses its panel in its own mount effect, which runs after this one, so focus on the next task.
  useEffect(() => {
    const id = setTimeout(() => ref.current?.focus(), 0);
    return () => clearTimeout(id);
  }, []);
  return (
    <Button ref={ref} variant="primary" className="w-full" onClick={close}>
      {label}
    </Button>
  );
}

/** Shown once per user, the first time Today opens. Any way of closing it counts as Continue. */
export function WelcomeSheet({ adminsAnyTeam }: { adminsAnyTeam: boolean }) {
  const { onboarding, updateOnboarding, club, access } = useAuth();
  const t = useT().onboarding.welcome;
  // Local state changes at once, so a pending or rejected write never brings the sheet back.
  const [dismissed, setDismissed] = useState(false);
  const written = useRef(false);

  if (!onboarding || onboarding.welcomed || dismissed || !club || !access) return null;

  const finish = () => {
    if (written.current) return;
    written.current = true;
    setDismissed(true);
    void Promise.resolve(updateOnboarding({ kind: 'welcomed' })).catch(() => {});
  };
  const rows = welcomeRows({ access, adminsAnyTeam });

  return (
    <Sheet variant="view" detent="large" title={t.title(club.name)} onClose={finish} footer={<ContinueButton label={t.continue} />}>
      <div className="flex flex-col items-center px-2 pb-2 pt-4 text-center">
        <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-lg bg-ink text-title-1 font-semibold text-on-ink">
          {clubInitials(club.name)}
        </span>
        <p className="mt-4 text-title-1 text-ink">{t.title(club.name)}</p>
        <p className="mt-1 text-body text-ink-2">{t.subtitle}</p>
      </div>
      <ul className="mt-6 flex flex-col gap-5 px-2">
        {rows.map((id) => {
          const Icon = ICONS[id];
          return (
            <li key={id} className="flex items-start gap-4">
              <Icon size={28} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-ink" />
              <div className="min-w-0">
                <h3 className="text-headline text-ink">{t[id].title}</h3>
                <p className="text-callout text-ink-2">{t[id].line}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
