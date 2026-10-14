import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoCropDialog } from './PhotoCropDialog';

describe('PhotoCropDialog', () => {
  it('shows an error for a non-image and cancels', async () => {
    const onCancel = vi.fn();
    render(<PhotoCropDialog open file={new File(['x'], 'a.txt', { type: 'text/plain' })} onCancel={onCancel} onDone={vi.fn()} />);
    expect(await screen.findByText('Choose an image file.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('says photos stay on the device', () => {
    render(<PhotoCropDialog open file={null} onCancel={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByText(/stays on this device/)).toBeInTheDocument();
  });
});
