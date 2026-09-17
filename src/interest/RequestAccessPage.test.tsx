import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RequestAccessPage } from './RequestAccessPage';
import * as interestApi from './interestApi';

vi.mock('./interestApi');

function renderPage() {
  return render(
    <MemoryRouter>
      <RequestAccessPage />
    </MemoryRouter>
  );
}

describe('RequestAccessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the form and shows a confirmation message', async () => {
    vi.mocked(interestApi.submitInterestSignup).mockResolvedValue(undefined);
    renderPage();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jamie Smith' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jamie@example.com' } });
    fireEvent.change(screen.getByLabelText('I am a...'), { target: { value: 'guardian' } });
    fireEvent.click(screen.getByText('Request access'));

    await waitFor(() => expect(screen.getByText(/thanks/i)).toBeInTheDocument());
    expect(interestApi.submitInterestSignup).toHaveBeenCalledWith({
      name: 'Jamie Smith', email: 'jamie@example.com', role: 'guardian',
    });
  });

  it('shows an error message when submission fails', async () => {
    vi.mocked(interestApi.submitInterestSignup).mockRejectedValue(new Error('network error'));
    renderPage();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jamie Smith' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jamie@example.com' } });
    fireEvent.click(screen.getByText('Request access'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
