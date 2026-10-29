import { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useModalLayer } from './useModalLayer';

function Layer({ name, onClose, panel = true }: { name: string; onClose: () => void; panel?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalLayer(onClose, panel ? ref : undefined);
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

function Harness2() {
  const [layer, setLayer] = useState<'none' | 'a' | 'picker' | 'edit'>('none');
  return (
    <>
      <button onClick={() => setLayer('a')}>Open A</button>
      <button onClick={() => setLayer('picker')}>Open picker</button>
      {layer === 'a' && <Layer name="a" onClose={() => setLayer('none')} />}
      {layer === 'picker' && (
        <div>
          <Layer name="picker" panel={false} onClose={() => setLayer('none')} />
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

  it('a replacing layer never returns focus to an element from an earlier, unrelated layer', () => {
    render(<Harness2 />);
    const openA = screen.getByText('Open A');
    openA.focus();
    fireEvent.click(openA);
    fireEvent.click(screen.getByText('close a'));
    expect(openA).toHaveFocus();

    const openPicker = screen.getByText('Open picker');
    openPicker.focus();
    fireEvent.click(openPicker);
    screen.getByText('swap').focus();
    fireEvent.click(screen.getByText('swap'));
    fireEvent.click(screen.getByText('close edit'));
    expect(openA).not.toHaveFocus();
  });
});
