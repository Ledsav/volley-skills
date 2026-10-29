import { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useModalLayer } from './useModalLayer';

function Layer({ name, onClose }: { name: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalLayer(onClose, ref);
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-label={name}>
      <button onClick={onClose}>{`close ${name}`}</button>
      <button>{`row ${name}`}</button>
    </div>
  );
}

function Harness() {
  const [layer, setLayer] = useState<'none' | 'picker' | 'edit'>('none');
  return (
    <>
      <button onClick={() => setLayer('picker')}>Open</button>
      {layer === 'picker' && (
        <div>
          <Layer name="picker" onClose={() => setLayer('none')} />
          <button onClick={() => setLayer('edit')}>swap</button>
        </div>
      )}
      {layer === 'edit' && <Layer name="edit" onClose={() => setLayer('none')} />}
    </>
  );
}

describe('useModalLayer focus return', () => {
  it('returns focus to the opener when the layer closes', () => {
    render(<Harness />);
    const open = screen.getByText('Open');
    open.focus();
    fireEvent.click(open);
    fireEvent.click(screen.getByText('close picker'));
    expect(open).toHaveFocus();
  });

  it('a layer that replaces another falls back to where the previous layer returned focus', () => {
    render(<Harness />);
    const open = screen.getByText('Open');
    open.focus();
    fireEvent.click(open);
    // The swap button lives in the picker's subtree; focus it, then replace the picker with the edit layer.
    screen.getByText('swap').focus();
    fireEvent.click(screen.getByText('swap'));
    expect(screen.getByRole('dialog', { name: 'edit' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('close edit'));
    expect(open).toHaveFocus();
  });
});
