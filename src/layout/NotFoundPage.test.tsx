import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { NotFoundPage } from './NotFoundPage';

describe('NotFoundPage', () => {
  it('shows the path, sets noindex, links home', () => {
    render(
      <MemoryRouter initialEntries={['/nope/here']}>
        <Routes>
          <Route path="/" element={<p>home page</p>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'This page is out of bounds' })).toBeInTheDocument();
    expect(screen.getByText('/nope/here')).toBeInTheDocument();
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex, nofollow');
    fireEvent.click(screen.getByRole('link', { name: 'Go home' }));
    expect(screen.getByText('home page')).toBeInTheDocument();
  });
});
