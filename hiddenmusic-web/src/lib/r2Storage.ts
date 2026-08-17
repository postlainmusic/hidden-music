export function getCoverCdnUrl(
  rawUrl?: string,
  options?: { width?: number; quality?: number }
): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  const publicBase =
    import.meta.env.PUBLIC_R2_URL || 'https://pub-1d0bee5762b4432cbce8cd4c1c010fa4.r2.dev';
  const cleanKey = rawUrl.replace(/^\/+/, '');
  return `${publicBase}/${cleanKey}`;
}
