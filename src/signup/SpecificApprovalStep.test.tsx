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
      <SpecificApprovalStep {...base} lang="en" isOperator={false} onSend={vi.fn().mockResolvedValue(undefined)} {...props} />
    </MemoryRouter>,
  );

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
    fireEvent.click(screen.getByRole('button', { name: 'Approve these clauses specifically' }));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/We've sent a confirmation link to ann@example.com\. Open it in this browser to sign\./)).toBeInTheDocument();
  });

  it('shows an inline error when sending fails', async () => {
    renderStep({ onSend: vi.fn().mockRejectedValue(new Error('x')) });
    fireEvent.click(screen.getByRole('button', { name: 'Approve these clauses specifically' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('explains to the operator instead of offering the button', () => {
    renderStep({ isOperator: true });
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument();
    expect(screen.getByText("The platform operator's account cannot sign for a club.")).toBeInTheDocument();
  });
});
