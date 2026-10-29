import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SpecificApprovalStep } from './SpecificApprovalStep';
import { SPECIFIC_SENTENCE } from '../legal/versions';
import { SPECIFIC_CLAUSE_IDS } from '../legal/specificClauses';

const base = { termsVersion: '2026-10-22', dpaVersion: '2026-10-22', email: 'ann@example.com' } as const;
const renderStep = (props: Partial<Parameters<typeof SpecificApprovalStep>[0]> = {}) =>
  render(
    <MemoryRouter>
      <SpecificApprovalStep {...base} lang="en" onSend={vi.fn().mockResolvedValue(undefined)} {...props} />
    </MemoryRouter>,
  );

const tickAllClauses = () => {
  for (const box of screen.getAllByRole('checkbox', { name: /specifically approve clause/ })) fireEvent.click(box);
};

describe('SpecificApprovalStep', () => {
  it('lists the 13 clauses in order', () => {
    renderStep();
    const ids = [...SPECIFIC_CLAUSE_IDS.terms, ...SPECIFIC_CLAUSE_IDS.dpa];
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(13);
    headings.forEach((h, i) => expect(h.textContent).toMatch(new RegExp(`^${ids[i]}\\.`)));
  });

  it('shows the Italian specific sentence on the clauses', () => {
    renderStep({ lang: 'it' });
    expect(screen.getAllByText(SPECIFIC_SENTENCE.it)).toHaveLength(13);
  });

  it('sends the link and confirms the address', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderStep({ onSend });
    tickAllClauses();
    fireEvent.click(screen.getByRole('button', { name: 'Approve these clauses specifically' }));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/We've sent a confirmation link to ann@example.com\. Open it in this browser to sign\./)).toBeInTheDocument();
  });

  it('shows an inline error when sending fails', async () => {
    renderStep({ onSend: vi.fn().mockRejectedValue(new Error('x')) });
    tickAllClauses();
    fireEvent.click(screen.getByRole('button', { name: 'Approve these clauses specifically' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('lists the 13 clauses in one group, each with its own checkbox', () => {
    renderStep();
    const ids = [...SPECIFIC_CLAUSE_IDS.terms, ...SPECIFIC_CLAUSE_IDS.dpa];
    const group = screen.getAllByRole('heading', { level: 3 })[0].closest('ul');
    expect(group?.querySelectorAll(':scope > li > article')).toHaveLength(13);
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(13);
    headings.forEach((h, i) => expect(h.textContent).toMatch(new RegExp(`^${ids[i]}\.`)));
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(13);
    boxes.forEach((b, i) => expect(b).toHaveAccessibleName(`I specifically approve clause ${ids[i]}`));
  });

  it('Approve stays disabled until every clause is ticked', () => {
    renderStep();
    const approve = screen.getByRole('button', { name: 'Approve these clauses specifically' });
    const boxes = screen.getAllByRole('checkbox');
    boxes.slice(0, 12).forEach((b) => fireEvent.click(b));
    expect(approve).toBeDisabled();
    fireEvent.click(boxes[12]);
    expect(approve).toBeEnabled();
  });

  it('ticks reset when the legal language changes', () => {
    const view = renderStep();
    tickAllClauses();
    view.rerender(
      <MemoryRouter>
        <SpecificApprovalStep {...base} lang="it" onSend={vi.fn()} />
      </MemoryRouter>,
    );
    screen.getAllByRole('checkbox').forEach((b) => expect(b).not.toBeChecked());
    expect(screen.getByRole('button', { name: 'Approve these clauses specifically' })).toBeDisabled();
  });
});
