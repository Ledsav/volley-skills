import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { GroupedList, ListRow } from './GroupedList';

describe('GroupedList', () => {
  it('a row with `to` is a link with a chevron', () => {
    render(
      <MemoryRouter>
        <GroupedList>
          <ListRow title="Ana" subtitle="Setter" to="/players/1" />
        </GroupedList>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /Ana/ });
    expect(link).toHaveAttribute('href', '/players/1');
    expect(link.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('Setter')).toBeInTheDocument();
  });

  it('a row with `onClick` is a button without a chevron', () => {
    const onClick = vi.fn();
    render(
      <GroupedList>
        <ListRow title="Export" onClick={onClick} />
      </GroupedList>,
    );
    const button = screen.getByRole('button', { name: 'Export' });
    expect(button.querySelector('svg')).toBeNull();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('a plain row has no interactive role', () => {
    render(
      <GroupedList>
        <ListRow title="Version" trailing="1.0" />
      </GroupedList>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('Version');
    expect(screen.getByRole('listitem')).toHaveTextContent('1.0');
  });

  it('the header renders as a heading in sentence case, and the footer follows the list', () => {
    render(
      <GroupedList header="Team members" footer="Only admins can edit.">
        <ListRow title="Ana" />
      </GroupedList>,
    );
    expect(screen.getByRole('heading', { name: 'Team members' })).toBeInTheDocument();
    expect(screen.getByText('Only admins can edit.')).toBeInTheDocument();
  });

  it('passes rowProps through to the row', () => {
    const onContextMenu = vi.fn();
    render(
      <GroupedList>
        <ListRow title="Ana" onClick={() => {}} rowProps={{ onContextMenu }} />
      </GroupedList>,
    );
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Ana' }));
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

  it('marks a selected row with aria-current', () => {
    render(
      <GroupedList>
        <ListRow title="Ana" onClick={() => {}} selected />
        <ListRow title="Bo" onClick={() => {}} />
      </GroupedList>,
    );
    expect(screen.getByRole('button', { name: 'Ana' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Bo' })).not.toHaveAttribute('aria-current');
  });
});
