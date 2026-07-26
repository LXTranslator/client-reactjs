/**
 * Client side file download helpers.
 *
 * The editor fetches export documents as JSON through the authenticated API
 * client, then hands them to the browser as a download. Going through `fetch`
 * rather than pointing an anchor at the endpoint is deliberate: a plain link
 * cannot carry the Authorization header.
 */

/**
 * Saves a value as a JSON file.
 *
 * @param {string} filename Suggested filename.
 * @param {unknown} value Serialisable value.
 * @returns {void}
 */
export function downloadJson(filename, value) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: 'application/json',
  });
  triggerDownload(filename, blob);
}

/**
 * Hands a blob to the browser as a download.
 *
 * The object URL is revoked immediately after the click, since leaving it alive
 * pins the blob in memory for the life of the document.
 *
 * @param {string} filename Suggested filename.
 * @param {Blob} blob Content.
 * @returns {void}
 */
export function triggerDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = sanitizeDownloadName(filename);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}

/**
 * Reduces a suggested filename to something safe to write to disk.
 *
 * The value originates from a locale code the server already validated, but it
 * is sanitised again here so a future caller cannot pass a path through.
 *
 * @param {string} filename Candidate name.
 * @returns {string} Safe name.
 */
export function sanitizeDownloadName(filename) {
  const base = String(filename).split(/[\\/]/).pop() ?? 'download.json';
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '');
  return cleaned.length === 0 ? 'download.json' : cleaned.slice(0, 128);
}
