import { describe, expect, it, vi, afterEach } from 'vitest';
import { api } from '../src/lib/apiClient.js';

/*
 * How an endpoint helper builds its URL.
 *
 * The page tests mock the API client, so they never see a URL. These call the
 * real helpers against a stubbed `fetch` and read back what was requested.
 */

describe('endpoint URLs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Stubs `fetch` with an empty success and returns the mock.
   *
   * @returns {object} The fetch mock.
   */
  function stubFetch() {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, headers: new Headers() });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('encodes every interpolated value as a single path segment', async () => {
    const fetchMock = stubFetch();

    await api.updateMember('team/a', 'member 1', {});

    // A slash in a value must never reach a different route.
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/namespaces/team%2Fa/settings/members/member%201',
    );
  });

  it('leaves an unused filter out of the query string', async () => {
    const fetchMock = stubFetch();

    await api.listUsage();
    await api.listUsage({ sessionId: 's_1', limit: 20 });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/usage');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/auth/usage?session_id=s_1&limit=20');
  });

  it('omits the default export format so a download URL is unchanged', async () => {
    const fetchMock = stubFetch();

    await api.downloadAll('file_1', 'default');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/files/file_1/download');
  });
});
