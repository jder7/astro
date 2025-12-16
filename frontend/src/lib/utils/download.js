export function downloadTextFile(content, filename, type = 'text/plain') {
  if (!content) return;
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadSvg(svgMarkup, filename = 'chart.svg') {
  downloadTextFile(svgMarkup, filename, 'image/svg+xml');
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn('Clipboard copy failed', err);
    return false;
  }
}
