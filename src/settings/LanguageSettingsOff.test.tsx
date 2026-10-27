import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageToggle } from '../i18n/LanguageToggle';
import { LanguageSettings } from './LanguageSettings';

describe('language choice (Italian not enabled)', () => {
  it('renders neither the Settings row nor the public toggle', () => {
    const { container } = render(<><LanguageSettings /><LanguageToggle /></>);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByLabelText('Language')).not.toBeInTheDocument();
  });
});
