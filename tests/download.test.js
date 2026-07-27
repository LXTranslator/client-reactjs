import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { api, apiRequest } from '../src/lib/apiClient.js';
import { sanitizeDownloadName, triggerDownload } from '../src/lib/download.js';

/*
 * Downloading a file.
 *
 * Two bugs lived here at once, and both were invisible to the page level tests
 * because those mock the API client and the download helper. So these exercise
 * the real ones.
 *
 * The first: a download endpoint serves the document itself, not the `{ data }`
 * envelope every other endpoint uses. Fetching one as JSON made the unwrapper
 * look for a `data` field that does not exist, hand back `null`, and write the
 * literal text `null` to disk.
 *
 * The second: revoking the object URL on the line after the click cancels a
 * download the browser has not finished reading, which is why an archive failed
 * where a small JSON document survived.
 */

describe('downloading a file', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('what the client asks for', () => {
    /**
     * Answers one request with a body of the given content type.
     *
     * @param {string} contentType Response content type.
     * @param {object} bodies Handlers for `json` and `blob`.
     * @returns {object} The fetch mock.
     */
    function respondWith(contentType, bodies) {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': contentType }),
        json: async () => bodies.json,
        blob: async () => bodies.blob,
      });

      vi.stubGlobal('fetch', fetchMock);
      return fetchMock;
    }

    it('returns the document itself for a single locale, never null', async () => {
      // The exact shape the server sends for `?lang=`: the document, with no
      // envelope around it. Unwrapping it is what produced `null`.
      const document = { block: { minecraft: { dirt: { value: 'Dirt', hash: 'a97ace' } } } };
      const body = new Blob([JSON.stringify(document, null, 2)], {
        type: 'application/json',
      });
      respondWith('application/json; charset=utf-8', { json: document, blob: body });

      const result = await api.downloadLocale('file_1', 'th_th');

      expect(result).toBeInstanceOf(Blob);
      expect(result).not.toBeNull();
      expect(JSON.parse(await result.text())).toEqual(document);
    });

    it('returns the archive as bytes', async () => {
      const zip = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], {
        type: 'application/zip',
      });
      respondWith('application/zip', { json: null, blob: zip });

      const result = await api.downloadArchive('file_1');

      expect(result).toBeInstanceOf(Blob);
      expect(result.size).toBe(4);
    });

    it('asks the archive endpoint for a zip', async () => {
      const fetchMock = respondWith('application/zip', {
        json: null,
        blob: new Blob(['zip']),
      });

      await api.downloadArchive('file_1', 'key_value');

      expect(fetchMock.mock.calls[0][0]).toContain('format=zip');
      expect(fetchMock.mock.calls[0][0]).toContain('export_format=key_value');
    });

    it('still reports a failure through the usual error envelope', async () => {
      // A blob request that fails must not hand back an unreadable blob of the
      // error page. The error path parses JSON whatever the caller asked for.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            error: { code: 'NOT_FOUND', message: 'That export format does not exist.' },
          }),
        }),
      );

      await expect(api.downloadArchive('file_1', 'gone')).rejects.toThrow(
        /export format does not exist/i,
      );
    });

    it('unwraps the envelope for an ordinary endpoint', async () => {
      // The counterpart to the first case: everything that is not a file still
      // answers with `{ data }`, and that is still what a caller gets.
      respondWith('application/json', {
        json: { data: { project: { id: 1 } } },
        blob: null,
      });

      await expect(apiRequest('/projects/1')).resolves.toEqual({ project: { id: 1 } });
    });
  });

  describe('handing it to the browser', () => {
    let created;
    let revoked;

    beforeEach(() => {
      created = [];
      revoked = [];

      // jsdom implements neither, so both are stood up here and recorded.
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn((blob) => {
          created.push(blob);
          return `blob:mock/${created.length}`;
        }),
        revokeObjectURL: vi.fn((url) => revoked.push(url)),
      });
    });

    it('does not revoke the object URL before the browser has read it', () => {
      vi.useFakeTimers();

      try {
        triggerDownload('langs.zip', new Blob(['zip'], { type: 'application/zip' }));

        // The click has happened and the download is under way. Revoking now is
        // what cancels it.
        expect(revoked).toEqual([]);

        vi.runAllTimers();
        expect(revoked).toEqual(['blob:mock/1']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('names the file and leaves no anchor behind', () => {
      const clicks = [];
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function record() {
          clicks.push({ href: this.href, download: this.download });
        });

      triggerDownload('langs.zip', new Blob(['zip']));

      expect(click).toHaveBeenCalledTimes(1);
      expect(clicks[0].download).toBe('langs.zip');
      expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    });
  });

  describe('the suggested filename', () => {
    it('keeps an ordinary locale name', () => {
      expect(sanitizeDownloadName('th_th.json')).toBe('th_th.json');
      expect(sanitizeDownloadName('langs.zip')).toBe('langs.zip');
    });

    it('strips a path out of a name', () => {
      expect(sanitizeDownloadName('../../etc/passwd')).toBe('passwd');
    });
  });
});
