import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentsStep } from './DocumentsStep';
import { DRAFT_BANNER, type LegalLang } from '../legal/versions';

function Harness({ onDone }: { onDone: () => void }) {
  const [lang, setLang] = useState<LegalLang>('en');
  return (
    <MemoryRouter>
      <DocumentsStep termsVersion="2026-10-22" dpaVersion="2026-10-22" lang={lang} onLangChange={setLang} onDone={onDone} />
    </MemoryRouter>
  );
}

const terms = () => screen.getByRole('checkbox', { name: /Terms of Service/ });
const dpa = () => screen.getByRole('checkbox', { name: /Data Processing Agreement/ });

function openBoth() {
  for (const link of screen.getAllByRole('link', { name: /Open in a new tab/ })) {
    link.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(link);
  }
}

describe('DocumentsStep', () => {
  it('keeps the checkboxes disabled until a document is opened', () => {
    render(<Harness onDone={vi.fn()} />);
    expect(terms()).toBeDisabled();
    expect(dpa()).toBeDisabled();
    openBoth();
    expect(terms()).toBeEnabled();
    expect(dpa()).toBeEnabled();
  });

  it('enables a checkbox once its box is scrolled to the end', () => {
    render(<Harness onDone={vi.fn()} />);
    const box = screen.getByRole('region', { name: /Terms of Service/ });
    Object.defineProperty(box, 'scrollHeight', { value: 1000 });
    Object.defineProperty(box, 'clientHeight', { value: 300 });
    box.scrollTop = 700;
    fireEvent.scroll(box);
    expect(terms()).toBeEnabled();
    expect(dpa()).toBeDisabled();
  });

  it('enables Next only when both are accepted', () => {
    const onDone = vi.fn();
    render(<Harness onDone={onDone} />);
    openBoth();
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
    fireEvent.click(terms());
    expect(next).toBeDisabled();
    fireEvent.click(dpa());
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(onDone).toHaveBeenCalled();
  });

  it('links to the sub-processors', () => {
    render(<Harness onDone={vi.fn()} />);
    expect(screen.getByRole('link', { name: /Sub-processors/ })).toHaveAttribute('href', expect.stringContaining('/legal/subprocessors'));
  });

  it('switching to Italiano shows the Italian banner and clears the checks', () => {
    render(<Harness onDone={vi.fn()} />);
    openBoth();
    fireEvent.click(terms());
    fireEvent.click(dpa());
    fireEvent.click(screen.getByRole('button', { name: 'Italiano' }));
    expect(screen.getAllByText(DRAFT_BANNER.it, { exact: false }).length).toBeGreaterThan(0);
    expect(terms()).not.toBeChecked();
    expect(dpa()).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
