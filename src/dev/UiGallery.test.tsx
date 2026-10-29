import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { NoticeProvider } from '../components/Notice';
import UiGallery from './UiGallery';

function renderGallery() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <NoticeProvider>
          <UiGallery />
        </NoticeProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('UiGallery', () => {
  it('renders with a heading', () => {
    renderGallery();
    expect(screen.getByRole('heading', { level: 1, name: 'UI gallery' })).toBeInTheDocument();
  });

  it('shows an Undo button after Delete sample', () => {
    renderGallery();
    fireEvent.click(screen.getByText('Delete sample'));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });
});
