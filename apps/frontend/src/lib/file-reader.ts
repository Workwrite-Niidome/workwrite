export async function readTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Try UTF-8 first
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true });
    return utf8.decode(bytes);
  } catch {
    // Fall back to Shift-JIS
  }

  try {
    const sjis = new TextDecoder('shift-jis', { fatal: false });
    return sjis.decode(bytes);
  } catch {
    // Last resort: lossy UTF-8
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}
