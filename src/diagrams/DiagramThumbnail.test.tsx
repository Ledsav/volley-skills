import { render, waitFor } from '@testing-library/react';
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
});
