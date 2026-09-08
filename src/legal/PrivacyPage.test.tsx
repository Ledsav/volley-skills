import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PrivacyPage } from './PrivacyPage';

describe('PrivacyPage', () => {
  it('renders the compliance-required sections', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText(/Draft policy/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What data we collect' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Why we collect it' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Who can see it' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Players are minors' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Retention' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your rights and data requests' })).toBeInTheDocument();
    expect(screen.getByText(/parent or legal guardian is the party who gives consent/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument();
    expect(screen.getByText(/\[insert the club's data-request contact address\]/)).toBeInTheDocument();
  });
});
