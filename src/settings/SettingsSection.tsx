import type { ReactNode } from 'react';

interface SettingsSectionProps {
  title: string;
  description: string;
  children: ReactNode;
}

/** A settings card: stacked on phones; title + description left, controls right from `lg`. */
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card lg:grid lg:grid-cols-3 lg:gap-6">
      <div className="lg:col-span-1">
        <h2 className="font-semibold text-ink">{title}</h2>
        <p className="text-sm text-slate">{description}</p>
      </div>
      <div className="flex flex-col gap-3 lg:col-span-2">{children}</div>
    </section>
  );
}
