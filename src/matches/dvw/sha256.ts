/** Lowercase hex SHA-256 of the file's raw bytes (the duplicate-import key). */
export async function sha256OfBytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
