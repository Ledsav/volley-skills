import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramThumbnail, clearDiagramThumbnailCache } from './DiagramThumbnail';
import * as diagramsApi from './diagramsApi';

vi.mock('./diagramsApi');
vi.mock('../firebase/config', () => ({ db: {} }));

const diagram = {
  id: 'd1', title: 'Setup', order: 0, updatedBy: 'x', updatedAt: null,
  scene: { v: 1 as const, court: 'full' as const, showZones: false, items: [] },
};

describe('DiagramThumbnail', () => {
  beforeEach(() => {
    clearDiagramThumbnailCache();
    vi.clearAllMocks();
  });

  it('fetches and renders an svg when a diagram exists', async () => {
    vi.mocked(diagramsApi.getFirstDiagram).mockResolvedValue(diagram);
    const { container } = render(<DiagramThumbnail exerciseId="ex-1" />);
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());
  });

  it('renders nothing when the exercise has no diagram', async () => {
    vi.mocked(diagramsApi.getFirstDiagram).mockResolvedValue(null);
    const { container } = render(<DiagramThumbnail exerciseId="ex-2" />);
    await waitFor(() => expect(diagramsApi.getFirstDiagram).toHaveBeenCalled());
    expect(container.querySelector('svg')).toBeNull();
  });

  it('serves a second mount for the same exercise from cache (no refetch)', async () => {
    vi.mocked(diagramsApi.getFirstDiagram).mockResolvedValue(diagram);
    const first = render(<DiagramThumbnail exerciseId="ex-1" />);
    await waitFor(() => expect(first.container.querySelector('svg')).not.toBeNull());
    first.unmount();
    render(<DiagramThumbnail exerciseId="ex-1" />);
    expect(diagramsApi.getFirstDiagram).toHaveBeenCalledTimes(1);
  });

  it('opens a lightbox with the diagram shown big when clicked', async () => {
    vi.mocked(diagramsApi.getFirstDiagram).mockResolvedValue(diagram);
    vi.mocked(diagramsApi.listDiagrams).mockResolvedValue([diagram]);
    render(<DiagramThumbnail exerciseId="ex-1" />);
    await screen.findByLabelText('Expand diagram Setup');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Expand diagram Setup'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('loads every diagram for the exercise into the lightbox, not just the first', async () => {
    const diagramTwo = { ...diagram, id: 'd2', title: 'Rotation', order: 1 };
    vi.mocked(diagramsApi.getFirstDiagram).mockResolvedValue(diagram);
    vi.mocked(diagramsApi.listDiagrams).mockResolvedValue([diagram, diagramTwo]);
    render(<DiagramThumbnail exerciseId="ex-1" />);
    await screen.findByLabelText('Expand diagram Setup');

    fireEvent.click(screen.getByLabelText('Expand diagram Setup'));

    await screen.findByRole('dialog');
    expect(diagramsApi.listDiagrams).toHaveBeenCalledWith('ex-1');
    expect(screen.getByLabelText('Next diagram')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Next diagram'));
    expect(screen.getByText('Rotation')).toBeInTheDocument();
  });

  it('falls back to just the preview diagram if listing all diagrams fails', async () => {
    vi.mocked(diagramsApi.getFirstDiagram).mockResolvedValue(diagram);
    vi.mocked(diagramsApi.listDiagrams).mockRejectedValue(new Error('permission-denied'));
    render(<DiagramThumbnail exerciseId="ex-1" />);
    await screen.findByLabelText('Expand diagram Setup');

    fireEvent.click(screen.getByLabelText('Expand diagram Setup'));

    await screen.findByRole('dialog');
    expect(screen.queryByLabelText('Next diagram')).not.toBeInTheDocument();
  });
});
