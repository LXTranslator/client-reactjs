/**
 * HTTP client for the LXTranslator API.
 *
 * Responsibilities kept deliberately narrow: build the request, attach the
 * session token, unwrap the response envelope, and turn a failure into a typed
 * error the interface can render. No component talks to `fetch` directly, so
 * error handling and token attachment cannot drift between pages.
 */

/** Base path. The dev server proxies this to the backend, so it stays relative. */
const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? '/api/v1';

/**
 * Error carrying the API's structured failure detail.
 */
export class ApiError extends Error {
  /**
   * @param {string} message Client safe message from the API.
   * @param {object} options Additional detail.
   * @param {number} options.status HTTP status code.
   * @param {string} [options.code] Stable machine readable code.
   * @param {Array<{field: string, message: string}>} [options.details] Field errors.
   */
  constructor(message, { status, code, details }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code ?? null;
    this.details = details ?? null;
  }

  /**
   * Maps field level validation failures onto form field names.
   *
   * @returns {Record<string, string>} Field name to message.
   */
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(this.details.map((entry) => [entry.field, entry.message]));
  }

  /** @returns {boolean} True when the session is missing or expired. */
  get isUnauthorized() {
    return this.status === 401;
  }
}

/** In memory session token. */
let authToken = null;

/**
 * Storage key. Session storage is used rather than local storage so the token
 * does not outlive the browser tab.
 */
const TOKEN_STORAGE_KEY = 'lxtranslator_token';

/**
 * Reads the stored token, tolerating a browser that blocks storage.
 *
 * @returns {string|null} The token, or null.
 */
function readStoredToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Sets the token used for subsequent requests.
 *
 * @param {string|null} token Session token, or null to clear it.
 * @returns {void}
 */
export function setAuthToken(token) {
  authToken = token;
  try {
    if (token === null) window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    else window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // A browser with storage disabled still works for the life of the tab,
    // because the token is also held in memory.
  }
}

/**
 * Returns the current token, restoring it from storage on first use.
 *
 * @returns {string|null} The token, or null.
 */
export function getAuthToken() {
  if (authToken === null) authToken = readStoredToken();
  return authToken;
}

/**
 * Performs a request and unwraps the response.
 *
 * @param {string} path Path below the API base.
 * @param {object} [options] Request options.
 * @param {string} [options.method] HTTP method.
 * @param {object} [options.body] JSON body.
 * @param {FormData} [options.formData] Multipart body, used for uploads.
 * @param {boolean} [options.auth] Attach the session token. Defaults to true.
 * @param {AbortSignal} [options.signal] Cancellation signal.
 * @param {'blob'} [options.responseType] Return the raw body instead of
 *   unwrapping an envelope. Required for any endpoint that serves a file, since
 *   those send the document itself and have no `data` field to unwrap.
 * @returns {Promise<object>} The `data` payload, or the body for a blob request.
 * @throws {ApiError} When the request fails.
 */
export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, formData, auth = true, signal, responseType } = options;

  const headers = {};
  if (auth) {
    const token = getAuthToken();
    if (token !== null) headers.Authorization = `Bearer ${token}`;
  }

  // The browser must set the multipart boundary itself, so Content-Type is
  // only declared for JSON bodies.
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError('Could not reach the server. Check your connection and try again.', {
      status: 0,
      code: 'NETWORK_ERROR',
    });
  }

  if (response.status === 204) return null;

  /*
   * A binary response carries no JSON to unwrap. The error path still parses
   * one, because a failure returns the usual error envelope whatever the caller
   * asked for.
   */
  if (responseType === 'blob' && response.ok) {
    return response.blob();
  }

  let payload = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null);
  }

  if (!response.ok) {
    const error = payload?.error ?? {};
    throw new ApiError(error.message ?? `The request failed with status ${response.status}.`, {
      status: response.status,
      code: error.code,
      details: error.details,
    });
  }

  /*
   * Every JSON endpoint answers with a `{ data }` envelope, so this is the
   * payload. An endpoint that serves a file does not, which is why those are
   * requested with `responseType: 'blob'` above and never reach this line.
   */
  return payload?.data ?? null;
}


/**
 * Builds an endpoint path, encoding every interpolated value as one segment.
 *
 * Used as a template tag, so `endpoint\`/files/${fileId}\`` cannot forget to
 * encode an identifier and a value holding a slash can never reach a different
 * route.
 *
 * @param {TemplateStringsArray} strings Literal parts of the template.
 * @param {...(string|number)} values Interpolated segments.
 * @returns {string} The path.
 */
function endpoint(strings, ...values) {
  return strings.reduce((path, part, index) => path + encodeURIComponent(values[index - 1]) + part);
}

/**
 * Appends a query string built from the parameters that carry a value.
 *
 * An absent, null or empty parameter is left out rather than sent empty, so an
 * optional filter costs nothing in the URL when it is not used.
 *
 * @param {string} path Endpoint path.
 * @param {Record<string, string|number|null|undefined>} params Query parameters.
 * @returns {string} The path with its query string, if any.
 */
function withQuery(path, params) {
  const entries = Object.entries(params).filter(([, value]) => value != null && value !== '');
  const query = new URLSearchParams(entries).toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Normalises an export format choice for a download query.
 *
 * `default` is dropped rather than sent, which keeps a download URL identical to
 * the one this client produced before formats existed, so a bookmarked or
 * scripted request is unaffected.
 *
 * @param {string} [exportFormat] Format identifier.
 * @returns {string|undefined} The identifier, or undefined for the default.
 */
function exportFormatParam(exportFormat) {
  return exportFormat === 'default' ? undefined : exportFormat;
}

/**
 * Endpoint helpers.
 *
 * Naming every endpoint in one object means a path change is a single edit, and
 * a component never assembles a URL by hand.
 */
export const api = {
  /* Authentication. */
  checkAvailability: (params) =>
    apiRequest(withQuery('/auth/availability', params), { auth: false }),
  register: (body) => apiRequest('/auth/register', { method: 'POST', body, auth: false }),
  login: (body) => apiRequest('/auth/login', { method: 'POST', body, auth: false }),
  forgotPassword: (body) =>
    apiRequest('/auth/password/forgot', { method: 'POST', body, auth: false }),
  resetPassword: (body) =>
    apiRequest('/auth/password/reset', { method: 'POST', body, auth: false }),
  me: () => apiRequest('/auth/me'),

  /* The second factor. */
  getTwoFactor: () => apiRequest('/auth/mfa'),
  setupTwoFactor: (body) => apiRequest('/auth/mfa/setup', { method: 'POST', body }),
  enableTwoFactor: (body) => apiRequest('/auth/mfa/enable', { method: 'POST', body }),
  disableTwoFactor: (body) => apiRequest('/auth/mfa/disable', { method: 'POST', body }),
  regenerateRecoveryCodes: (body) =>
    apiRequest('/auth/mfa/recovery_codes', { method: 'POST', body }),
  // Unauthenticated: the caller holds a challenge, which is not a session and
  // can do nothing else.
  completeMfaChallenge: (body) =>
    apiRequest('/auth/login/mfa', { method: 'POST', body, auth: false }),

  /* Provider sign in. */
  listAuthProviders: () => apiRequest('/auth/oauth/providers', { auth: false }),
  startOauthLogin: (provider) =>
    apiRequest(endpoint`/auth/oauth/${provider}/login/start`, {
      method: 'POST',
      body: {},
      auth: false,
    }),
  completeOauthLogin: (body) =>
    apiRequest('/auth/oauth/login/callback', { method: 'POST', body, auth: false }),
  startOauthLink: (provider) =>
    apiRequest(endpoint`/auth/oauth/${provider}/link/start`, { method: 'POST', body: {} }),
  completeOauthLink: (body) =>
    apiRequest('/auth/oauth/link/callback', { method: 'POST', body }),
  listOauthIdentities: () => apiRequest('/auth/oauth/identities'),
  unlinkOauthProvider: (provider) =>
    apiRequest(endpoint`/auth/oauth/${provider}`, { method: 'DELETE' }),

  /* Account settings. */
  getSettings: () => apiRequest('/settings'),
  confirmPassword: (body) => apiRequest('/settings/confirm', { method: 'POST', body }),
  updateUserId: (body) => apiRequest('/settings/identifier', { method: 'PATCH', body }),
  updateEmail: (body) => apiRequest('/settings/email', { method: 'PATCH', body }),
  updatePassword: (body) => apiRequest('/settings/password', { method: 'PATCH', body }),
  updateProfile: (body) => apiRequest('/settings/profile', { method: 'PATCH', body }),

  /* Namespaces and organizations. */
  listNamespaces: () => apiRequest('/namespaces'),
  createOrganization: (body) =>
    apiRequest('/namespaces/organizations', { method: 'POST', body }),
  getNamespace: (namespace) => apiRequest(endpoint`/namespaces/${namespace}`),
  updateNamespace: (namespace, body) =>
    apiRequest(endpoint`/namespaces/${namespace}/settings`, { method: 'PATCH', body }),
  /**
   * Permanently deletes an organization.
   *
   * The identifier must be echoed in the body; the server rejects a mismatch,
   * which is what stops a misdirected request from deleting the wrong
   * namespace.
   */
  deleteNamespace: (namespace, confirmUserId) =>
    apiRequest(endpoint`/namespaces/${namespace}`, {
      method: 'DELETE',
      body: { confirm_user_id: confirmUserId },
    }),
  listMembers: (namespace) => apiRequest(endpoint`/namespaces/${namespace}/settings/members`),
  addMember: (namespace, body) =>
    apiRequest(endpoint`/namespaces/${namespace}/settings/members`, { method: 'POST', body }),
  updateMember: (namespace, memberId, body) =>
    apiRequest(endpoint`/namespaces/${namespace}/settings/members/${memberId}`, {
      method: 'PATCH',
      body,
    }),
  removeMember: (namespace, memberId) =>
    apiRequest(endpoint`/namespaces/${namespace}/settings/members/${memberId}`, {
      method: 'DELETE',
    }),

  /*
   * Sessions and API tokens.
   *
   * A session is a row on the server now, so signing out ends it there rather
   * than only forgetting the token here. An API token is the credential a
   * script uses; it is returned once by `createApiToken` and never again.
   */
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  listSessions: () => apiRequest('/auth/sessions'),
  revokeSession: (sessionId) =>
    apiRequest(endpoint`/auth/sessions/${sessionId}`, { method: 'DELETE' }),
  revokeOtherSessions: () =>
    apiRequest('/auth/sessions/revoke_others', { method: 'POST' }),
  listApiTokens: () => apiRequest('/auth/api_tokens'),
  createApiToken: (body) => apiRequest('/auth/api_tokens', { method: 'POST', body }),
  revokeApiToken: (tokenId) =>
    apiRequest(endpoint`/auth/api_tokens/${tokenId}`, { method: 'DELETE' }),
  listUsage: ({ sessionId, limit } = {}) =>
    apiRequest(withQuery('/auth/usage', { session_id: sessionId, limit })),
  getUsageSummary: (days) => apiRequest(withQuery('/auth/usage/summary', { days })),

  /* Projects. */
  listProjects: (namespace) => apiRequest(endpoint`/namespaces/${namespace}/projects`),
  createProject: (namespace, body) =>
    apiRequest(endpoint`/namespaces/${namespace}/projects`, { method: 'POST', body }),
  getProject: (projectId) => apiRequest(endpoint`/projects/${projectId}`),
  updateProject: (projectId, body) =>
    apiRequest(endpoint`/projects/${projectId}/settings`, { method: 'PATCH', body }),
  deleteProject: (projectId) => apiRequest(endpoint`/projects/${projectId}`, { method: 'DELETE' }),

  /*
   * A project has no credentials of its own. It names a platform and a model,
   * and the key that pays for it comes from the account that owns it. See the
   * namespace credential methods below.
   */

  /* Files. */
  listFiles: (projectId) => apiRequest(endpoint`/projects/${projectId}/files`),
  uploadFile: (projectId, formData) =>
    apiRequest(endpoint`/projects/${projectId}/files`, { method: 'POST', formData }),
  getFile: (fileId) => apiRequest(endpoint`/files/${fileId}`),
  deleteFile: (fileId) => apiRequest(endpoint`/files/${fileId}`, { method: 'DELETE' }),
  reprocessFile: (fileId) => apiRequest(endpoint`/files/${fileId}/reprocess`, { method: 'POST' }),
  addFileLanguages: (fileId, body) =>
    apiRequest(endpoint`/files/${fileId}/languages`, { method: 'POST', body }),
  mergeFileKeys: (fileId, formData) =>
    apiRequest(endpoint`/files/${fileId}/keys`, { method: 'POST', formData }),

  /*
   * Namespace AI credentials.
   *
   * The only credentials there are. They pay for everything the namespace sends
   * to a vendor: translating files inside its projects and answering questions
   * in the assistant alike. Inside an organization every one of them needs
   * ADMIN, reading included, because the list is a statement about the
   * organization's spending.
   */
  listAccountKeys: (namespace) => apiRequest(endpoint`/namespaces/${namespace}/settings/ai_keys`),
  addAccountKey: (namespace, body) =>
    apiRequest(endpoint`/namespaces/${namespace}/settings/ai_keys`, { method: 'POST', body }),
  updateAccountKey: (namespace, keyId, body) =>
    apiRequest(endpoint`/namespaces/${namespace}/settings/ai_keys/${keyId}`, {
      method: 'PATCH',
      body,
    }),
  removeAccountKey: (namespace, keyId) =>
    apiRequest(endpoint`/namespaces/${namespace}/settings/ai_keys/${keyId}`, {
      method: 'DELETE',
    }),
  reorderAccountKeys: (namespace, orderedKeyIds) =>
    apiRequest(endpoint`/namespaces/${namespace}/settings/ai_keys/reorder`, {
      method: 'POST',
      body: { ordered_key_ids: orderedKeyIds },
    }),

  /*
   * The assistant.
   *
   * A turn may carry an attachment, so `sendChat` takes either a JSON body or a
   * FormData. The browser must set the multipart boundary itself, which is why
   * the two are kept apart rather than always sending a form.
   */
  sendChat: (namespace, payload) =>
    apiRequest(endpoint`/namespaces/${namespace}/chat`, {
      method: 'POST',
      ...(payload instanceof FormData ? { formData: payload } : { body: payload }),
    }),
  listChatSessions: (namespace) => apiRequest(endpoint`/namespaces/${namespace}/chat/sessions`),
  getChatSession: (namespace, sessionId) =>
    apiRequest(endpoint`/namespaces/${namespace}/chat/sessions/${sessionId}`),
  renameChatSession: (namespace, sessionId, title) =>
    apiRequest(endpoint`/namespaces/${namespace}/chat/sessions/${sessionId}`, {
      method: 'PATCH',
      body: { title },
    }),
  deleteChatSession: (namespace, sessionId) =>
    apiRequest(endpoint`/namespaces/${namespace}/chat/sessions/${sessionId}`, {
      method: 'DELETE',
    }),
  searchChats: (namespace, query, limit) =>
    apiRequest(withQuery(endpoint`/namespaces/${namespace}/chat/search`, { q: query, limit })),
  backfillChatEmbeddings: (namespace, body = {}) =>
    apiRequest(endpoint`/namespaces/${namespace}/chat/embeddings`, { method: 'POST', body }),
  getChatLogBuffer: (namespace) => apiRequest(endpoint`/namespaces/${namespace}/chat/log_buffer`),

  /* Export formats. */
  listExportFormats: (namespace) => apiRequest(endpoint`/namespaces/${namespace}/export_formats`),
  createExportFormat: (namespace, body) =>
    apiRequest(endpoint`/namespaces/${namespace}/export_formats`, { method: 'POST', body }),
  updateExportFormat: (namespace, formatId, body) =>
    apiRequest(endpoint`/namespaces/${namespace}/export_formats/${formatId}`, {
      method: 'PATCH',
      body,
    }),
  removeExportFormat: (namespace, formatId) =>
    apiRequest(endpoint`/namespaces/${namespace}/export_formats/${formatId}`, {
      method: 'DELETE',
    }),
  /** The same catalogue, reached from the file being downloaded. */
  listFileExportFormats: (fileId) => apiRequest(endpoint`/files/${fileId}/export_formats`),

  /* Translations. */
  getTranslations: (fileId) => apiRequest(endpoint`/files/${fileId}/translations`),
  updateTranslation: (fileId, translationId, body) =>
    apiRequest(endpoint`/files/${fileId}/translations/${translationId}`, {
      method: 'PATCH',
      body,
    }),
  updateMasterText: (fileId, keyId, body) =>
    apiRequest(endpoint`/files/${fileId}/keys/${keyId}`, { method: 'PATCH', body }),
  /** Refreshes the named keys only. Everything else is left untouched. */
  retranslateKeys: (fileId, body) =>
    apiRequest(endpoint`/files/${fileId}/keys/retranslate`, { method: 'POST', body }),
  /**
   * Validates that every language still matches the English master.
   *
   * On demand only. The server reads every key and every translation to answer
   * it, which is why nothing calls this on a keystroke.
   */
  checkConsistency: (fileId, lang) =>
    apiRequest(withQuery(endpoint`/files/${fileId}/consistency`, { lang })),

  /*
   * Downloads.
   *
   * `format` is how the download is packaged and `export_format` is the shape of
   * the documents inside it. They are separate on the server for that reason,
   * and kept separate here so a caller cannot conflate them.
   *
   * All three are file endpoints: the server sets `Content-Disposition` and
   * sends the document itself, not the `{ data }` envelope every other endpoint
   * uses. So all three are fetched as blobs, and the bytes the server produced
   * are the bytes that reach the disk.
   *
   * Asking for one of these as JSON is what broke the single locale download:
   * the unwrapper looked for `data` on a document that has no such field and
   * handed back `null`, which was then written out as the literal text `null`.
   */
  downloadAll: (fileId, exportFormat) =>
    apiRequest(
      withQuery(endpoint`/files/${fileId}/download`, {
        export_format: exportFormatParam(exportFormat),
      }),
      { responseType: 'blob' },
    ),
  downloadArchive: (fileId, exportFormat) =>
    apiRequest(
      withQuery(endpoint`/files/${fileId}/download`, {
        format: 'zip',
        export_format: exportFormatParam(exportFormat),
      }),
      { responseType: 'blob' },
    ),
  downloadLocale: (fileId, lang, exportFormat) =>
    apiRequest(
      withQuery(endpoint`/files/${fileId}/download`, {
        lang,
        export_format: exportFormatParam(exportFormat),
      }),
      { responseType: 'blob' },
    ),

  /* Catalogue. */
  listProviders: () => apiRequest('/providers', { auth: false }),
};
