import { useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { normalize } from '../../search/searchTokens';
import type { TeamRow } from '../../access/accessApi';
import { useT } from '../../i18n/I18nProvider';

interface Props {
  teams: TeamRow[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  onLoadMore: () => void;
  selected: string[];
  onToggle: (teamId: string) => void;
}

/** The "Teams" checklist: a filter over the loaded teams, then Load more for the rest. */
export function TeamGrantList({ teams, hasMore, loadingMore, loadMoreFailed, onLoadMore, selected, onToggle }: Props) {
  const p = useT().clubs.people;
  const [filter, setFilter] = useState('');
  const needle = normalize(filter.trim());
  const shown = needle ? teams.filter((x) => normalize(x.name).includes(needle)) : teams;

  return (
    <fieldset className="mb-4">
      <legend className="mb-2 text-footnote text-ink-2">{p.teamsLegend}</legend>
      {teams.length > 0 && (
        <Input type="search" aria-label={p.filterTeams} placeholder={p.filterTeams}
          value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-2 w-full" />
      )}
      <div className="flex flex-col">
        {shown.map((x) => (
          <label key={x.id} className="flex min-h-[52px] items-center gap-3 text-body text-ink">
            <input type="checkbox" aria-label={x.name} className="h-5 w-5"
              checked={selected.includes(x.id)} onChange={() => onToggle(x.id)} />
            {x.name}
          </label>
        ))}
      </div>
      {needle && shown.length === 0 && <p className="py-2 text-footnote text-ink-2">{p.noTeamsMatch}</p>}
      {hasMore && (
        <Button variant="secondary" size="sm" className="mt-2" disabled={loadingMore} onClick={onLoadMore}>
          {p.loadMoreTeams}
        </Button>
      )}
      {loadMoreFailed && <p role="alert" className="mt-2 text-footnote text-red-strong">{p.loadMoreTeamsFailed}</p>}
    </fieldset>
  );
}
