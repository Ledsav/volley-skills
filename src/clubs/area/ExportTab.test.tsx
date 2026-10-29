import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportTab } from './ExportTab';
import { WithChrome } from '../../test/chromeProbe';
import { loadClubExportData } from '../export/clubExportApi';
import * as exportJson from '../../export/exportJson';
import type { ClubExportData } from '../export/clubExport';

const notify = vi.hoisted(() => vi.fn());

vi.mock('../export/clubExportApi', () => ({ loadClubExportData: vi.fn() }));
vi.mock('../../components/Notice', () => ({ useNotify: () => notify }));

const EMPTY: ClubExportData = {
  club: { id: 'c1', name: 'VC Test' },
  members: [],
  acceptances: [],
  statusLog: [],
  teams: [],
  exercises: [],
  trainings: [],
  counters: [],
  skillGuide: null,
  physicalTestGuide: null,
  sectionAccess: [],
};

let download: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  download = vi.spyOn(exportJson, 'downloadBlob').mockImplementation(() => {});
});

const button = () => screen.getByRole('button', { name: /download export/i });

describe('ExportTab', () => {
  it('downloads one zip named after the club', async () => {
    vi.mocked(loadClubExportData).mockResolvedValue(EMPTY);
    render(<WithChrome><ExportTab /></WithChrome>);
    fireEvent.click(button());
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    const [name, blob] = download.mock.calls[0] as [string, Blob];
    expect(name).toMatch(/^club-.+-export-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(blob.type).toBe('application/zip');
    expect(notify).toHaveBeenCalledWith('Export downloaded');
  });

  it('shows progress and disables the button while running', async () => {
    vi.mocked(loadClubExportData).mockImplementation((onProgress) => {
      onProgress('Team 1 of 2: U17');
      return new Promise(() => {});
    });
    render(<WithChrome><ExportTab /></WithChrome>);
    fireEvent.click(button());
    expect(await screen.findByRole('status')).toHaveTextContent('Team 1 of 2: U17');
    expect(button()).toBeDisabled();
  });

  it('a failed load downloads nothing', async () => {
    vi.mocked(loadClubExportData).mockRejectedValue(new Error('Missing or insufficient permissions.'));
    render(<WithChrome><ExportTab /></WithChrome>);
    fireEvent.click(button());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Export failed: Missing or insufficient permissions. Nothing was downloaded.',
    );
    expect(download).not.toHaveBeenCalled();
    await waitFor(() => expect(button()).not.toBeDisabled());
  });
});
