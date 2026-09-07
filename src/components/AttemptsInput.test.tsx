import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttemptsInput } from './AttemptsInput';

describe('AttemptsInput', () => {
  it('renders one labeled input per value', () => {
    render(<AttemptsInput name="cmj" label="Attempt" values={[30, 34, 32]} onChange={vi.fn()} minCount={3} />);

    expect(screen.getByLabelText('Attempt 1')).toHaveValue(30);
    expect(screen.getByLabelText('Attempt 2')).toHaveValue(34);
    expect(screen.getByLabelText('Attempt 3')).toHaveValue(32);
  });

  it('calls onChange with the updated array when an attempt value changes', () => {
    const onChange = vi.fn();
    render(<AttemptsInput name="cmj" label="Attempt" values={[30, 34, 32]} onChange={onChange} minCount={3} />);

    fireEvent.change(screen.getByLabelText('Attempt 2'), { target: { value: '40' } });

    expect(onChange).toHaveBeenCalledWith([30, 40, 32]);
  });

  it('does not show add/remove controls when maxCount is not provided', () => {
    render(<AttemptsInput name="cmj" label="Attempt" values={[30, 34, 32]} onChange={vi.fn()} minCount={3} />);

    expect(screen.queryByText('+ Add attempt')).not.toBeInTheDocument();
    expect(screen.queryByText('Remove last attempt')).not.toBeInTheDocument();
  });

  it('adds an attempt up to maxCount, and allows removing back down to minCount', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AttemptsInput name="sprint" label="Attempt" values={[1.85, 1.9]} onChange={onChange} minCount={2} maxCount={3} />
    );

    fireEvent.click(screen.getByText('+ Add attempt'));
    expect(onChange).toHaveBeenCalledWith([1.85, 1.9, NaN]);

    rerender(
      <AttemptsInput name="sprint" label="Attempt" values={[1.85, 1.9, 1.79]} onChange={onChange} minCount={2} maxCount={3} />
    );
    expect(screen.queryByText('+ Add attempt')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Remove last attempt'));
    expect(onChange).toHaveBeenCalledWith([1.85, 1.9]);
  });
});
