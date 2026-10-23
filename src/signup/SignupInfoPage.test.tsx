import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { SignupInfoPage } from './SignupInfoPage';

describe('SignupInfoPage', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('is indexable with its canonical path (a public route)', () => {
    render(<MemoryRouter><SignupInfoPage /></MemoryRouter>);
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('index, follow');
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toMatch(/\/signup$/);
  });
});
