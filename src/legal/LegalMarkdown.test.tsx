import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LegalMarkdown } from './LegalMarkdown';

const show = (text: string) => render(<MemoryRouter><LegalMarkdown text={text} /></MemoryRouter>);

describe('LegalMarkdown', () => {
  it('gives a clause heading an id', () => {
    show('## T12. Liability');
    const h = screen.getByRole('heading', { level: 2, name: 'T12. Liability' });
    expect(h).toHaveAttribute('id', 't12');
  });

  it('renders unsafe link targets as plain text', () => {
    const { container } = show('[x](javascript:alert(1)) and [y](//evil.example) and [z](http://plain.example)');
    expect(container.querySelector('a')).toBeNull();
    expect(container).toHaveTextContent('x and y and z');
  });

  it('renders safe links', () => {
    show('[dpa](/legal/dpa) [web](https://example.org) [mail](mailto:a@b.org)');
    expect(screen.getByRole('link', { name: 'dpa' })).toHaveAttribute('href', '/legal/dpa');
    expect(screen.getByRole('link', { name: 'web' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'mail' })).toHaveAttribute('href', 'mailto:a@b.org');
  });

  it('renders tables, bold, lists and quotes', () => {
    const { container } = show('| A | B |\n|---|---|\n| 1 | **two** |\n\n- one\n- two\n\n1. first\n\n> note');
    expect(screen.getByRole('columnheader', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument();
    expect(container.querySelector('td strong')).toHaveTextContent('two');
    expect(container.querySelectorAll('ul li')).toHaveLength(2);
    expect(container.querySelectorAll('ol li')).toHaveLength(1);
    expect(container.querySelector('blockquote')).toHaveTextContent('note');
  });
});
