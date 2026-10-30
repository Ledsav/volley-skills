import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { FIELD_CLASS, Input, Textarea } from '../components/Input';
import { HealthHint } from '../components/HealthHint';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../auth/AuthContext';
import { deleteTeam, updateTeamInfo } from './teamsApi';
import { loadTeamExportData } from './teamExportApi';
import { downloadTeamExport } from './teamExport';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';
import { GENDERS, isGender } from './teamGender';
import type { Team } from '../types/team';
import { LIMITS } from '../types/limits';

interface TeamSettingsTabProps {
  team: Team;
  onTeamUpdated: (team: Team) => void;
}

export function TeamSettingsTab({ team, onTeamUpdated }: TeamSettingsTabProps) {
  const navigate = useNavigate();
  const { access } = useAuth();
  const t = useT();
  const [name, setName] = useState(team.name);
  const [gender, setGender] = useState<Gender | ''>(team.gender ?? '');
  const [description, setDescription] = useState(team.description ?? '');
  const [notes, setNotes] = useState(team.notes ?? '');
  const [infoError, setInfoError] = useState<string | null>(null);
  const [savingInfo, setSavingInfo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [includeEvents, setIncludeEvents] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleSaveInfo(event: FormEvent) {
    event.preventDefault();
    setInfoError(null);
    if (!isGender(gender)) return;
    setSavingInfo(true);
    const updates = { name: name.trim(), description: description.trim(), notes: notes.trim(), gender };
    try {
      await updateTeamInfo(team.id, updates);
    } catch {
      setInfoError(t.teams.settings.infoError);
      setSavingInfo(false);
      return;
    }
    onTeamUpdated({ ...team, ...updates });
    setSavingInfo(false);
  }

  async function handleExport() {
    setExportError(null);
    setExporting(true);
    try {
      const data = await loadTeamExportData(team.id, { includeEvents, includeCalendar: !!access?.sections.trainings });
      downloadTeamExport(data);
    } catch {
      setExportError(t.teams.settings.exportError);
    }
    setExporting(false);
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteTeam(team.id);
    } catch {
      setDeleteError(t.teams.settings.deleteError);
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    // Forms stay at reading width (design system: forms ≤ 720 px).
    <div className="flex max-w-[720px] flex-col gap-4">
        <form onSubmit={handleSaveInfo} className="rounded-lg bg-surface p-4 shadow-card">
          <h2 className="mb-3 text-title-3 text-ink">{t.teams.settings.infoTitle}</h2>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-footnote text-ink-2">
              {t.teams.settings.teamName}
              <Input maxLength={LIMITS.shortText} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1.5 text-footnote text-ink-2">
              {t.teams.gender.label}
              <select
                className={`${FIELD_CLASS} w-full`}
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender | '')}
                required
              >
                <option value="" disabled>
                  {t.teams.gender.choose}
                </option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {t.teams.gender[g]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-footnote text-ink-2">
              {t.teams.settings.description}
              <Textarea maxLength={LIMITS.longText} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full resize-none" />
            </label>
            <div className="flex flex-col gap-1.5 text-footnote text-ink-2">
              <label htmlFor="team-info-notes">{t.teams.settings.notes}</label>
              <Textarea id="team-info-notes" aria-describedby="team-info-notes-hint" maxLength={LIMITS.longText} value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full resize-none" />
              <HealthHint id="team-info-notes-hint" />
            </div>
          </div>
          {infoError && <p role="alert" className="mt-3 text-callout text-red-strong">{infoError}</p>}
          <Button variant="primary" size="sm" type="submit" className="mt-3 w-full sm:w-auto" disabled={savingInfo || gender === ''}>
            {t.teams.settings.saveInfo}
          </Button>
        </form>

        <section className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-title-3 text-ink">{t.teams.settings.exportTitle}</h2>
            <p className="mt-1 text-callout text-ink-2">
              {t.teams.settings.exportBody(!!access?.sections.trainings)}
            </p>
            <label className="mt-2 flex items-center gap-2 text-callout text-ink">
              <input type="checkbox" checked={includeEvents} onChange={(e) => setIncludeEvents(e.target.checked)} />
              {t.teams.settings.includeEvents}
            </label>
            {exportError && <p role="alert" className="mt-2 text-callout text-red-strong">{exportError}</p>}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => void handleExport()}
            disabled={exporting}
          >
            {exporting ? t.teams.settings.exporting : t.teams.settings.exportButton}
          </Button>
        </section>

        {access?.isClubAdmin && (
          <section className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-title-3 text-ink">{t.teams.settings.dangerTitle}</h2>
              <p className="mt-1 text-callout text-ink-2">
                {t.teams.settings.dangerBody}
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="w-full shrink-0 sm:w-auto"
              onClick={() => setShowDeleteConfirm(true)}
            >
              {t.teams.settings.deleteButton}
            </Button>
          </section>
        )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title={t.teams.settings.deleteTitle(team.name)}
          message={t.teams.settings.deleteMessage}
          confirmLabel={t.teams.settings.deleteConfirm}
          onConfirm={() => void handleDelete()}
          onCancel={() => setShowDeleteConfirm(false)}
          error={deleteError}
        />
      )}
    </div>
  );
}
