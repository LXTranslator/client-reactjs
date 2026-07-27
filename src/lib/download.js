/**
 * Client side file download helpers.
 *
 * The editor fetches export documents through the authenticated API client and
 * hands the bytes to the browser. Going through `fetch` rather than pointing an
 * anchor at the endpoint is deliberate: a plain link cannot carry the
 * Authorization header.
 *
 * Every download endpoint is fetched as a blob, and what the server produced is
 * what lands on disk. The client does not parse a document and write it out
 * again: the server already chose the shape, the field names and the
 * indentation, and re-serialising them here can only lose something.
 */

/** How long a finished object URL is left alive before it is released. */
const REVOKE_DELAY_MS = 60_000;

/**
 * Hands a blob to the browser as a download.
 *
 * The object URL is released on a timer rather than on the next line. A click
 * on an anchor only *starts* a download; the browser reads the blob afterwards,
 * and revoking the URL in the same task can cancel a download that had not
 * finished reading yet. That is not hypothetical, and it gets likelier the
 * larger the blob, which is why an archive would fail where a small JSON
 * document survived.
 *
 * The delay is bounded so a long session cannot pin every file it ever
 * downloaded in memory.
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
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
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
