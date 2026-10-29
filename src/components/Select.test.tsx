import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Field, FieldLabel, FIELD_CLASS, FIELD_LABEL_CLASS, Input } from './Input';
import { Select, SelectField } from './Select';

describe('Select and form labels', () => {
  it('Select is a native select dressed as a full-width field', () => {
    render(
      <Select aria-label="Position" defaultValue="S">
        <option value="S">Setter</option>
        <option value="L">Libero</option>
      </Select>,
    );
    const select = screen.getByRole('combobox', { name: 'Position' });
    expect(select.tagName).toBe('SELECT');
    for (const c of FIELD_CLASS.split(' ')) expect(select).toHaveClass(c);
    expect(select).toHaveClass('w-full');
  });

  it('SelectField labels its select and reports changes', () => {
    const onChange = vi.fn();
    render(
      <SelectField label="Shirt size" hint="Optional" value="" onChange={(e) => onChange(e.target.value)}>
        <option value="">Not set</option>
        <option value="M">M</option>
      </SelectField>,
    );
    fireEvent.change(screen.getByRole('combobox', { name: /Shirt size/ }), { target: { value: 'M' } });
    expect(onChange).toHaveBeenCalledWith('M');
    expect(screen.getByText('Optional')).toBeInTheDocument();
  });

  it('Field and FieldLabel share the one label style', () => {
    render(
      <>
        <Field label="Name">
          <Input />
        </Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input id="email" />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument();
    for (const c of ['text-footnote', 'text-ink-2']) {
      expect(FIELD_LABEL_CLASS).toContain(c);
      expect(screen.getByText('Name')).toHaveClass(c);
      expect(screen.getByText('Email')).toHaveClass(c);
    }
  });
});
