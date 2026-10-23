import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PrivacyPage } from './PrivacyPage';
import { DRAFT_BANNER } from './versions';

describe('PrivacyPage', () => {
  it('renders the privacy notice with the operator and the controller role', () => {
    render(
      <MemoryRouter initialEntries={['/privacy?lang=en']}>
        <PrivacyPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeInTheDocument();
    expect(screen.getByText(DRAFT_BANNER.en + '.')).toBeInTheDocument();
    expect(screen.getAllByText(/controller/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Alberto Valdes Rey/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Report content' })).toBeInTheDocument();
  });
});
