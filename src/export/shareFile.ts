/** Hands files to the OS share sheet (phone: straight into a chat), falling back to downloads. */

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke later: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareOrDownload(files: File[], title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files }) && typeof navigator.share === 'function') {
    try {
      await navigator.share({ files, title });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // otherwise fall through to download
    }
  }
  for (let i = 0; i < files.length; i++) {
    download(files[i]);
    if (i < files.length - 1) await new Promise((r) => setTimeout(r, 300));
  }
  return 'downloaded';
}
