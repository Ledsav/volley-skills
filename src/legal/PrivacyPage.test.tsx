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
    expect(screen.getByText(/cached on the device until you sign out/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Text scouting (optional)' })).toBeInTheDocument();
    expect(screen.getByText(/sent to the AI provider they choose/i)).toBeInTheDocument();
    for (const heading of ['Who is responsible', 'Service providers', 'Changes']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText(/these notes leave the EU/i)).toBeInTheDocument();
    expect(screen.getByText(/data-protection authority of the EU country/i)).toBeInTheDocument();
    expect(screen.getByText(/Access requests are deleted once they have been handled/i)).toBeInTheDocument();
    expect(screen.getByText(/for 12 months after they leave/i)).toBeInTheDocument();
    const contacts = screen.getAllByRole('link', { name: 'alberto.valdes.rey.official@gmail.com' });
    expect(contacts.length).toBeGreaterThan(0);
    contacts.forEach((a) => expect(a).toHaveAttribute('href', 'mailto:alberto.valdes.rey.official@gmail.com'));
  });
});
