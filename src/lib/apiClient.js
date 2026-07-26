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
 * @returns {Promise<object>} The `data` payload.
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

  return payload?.data ?? null;
}

/**
 * Builds the `export_format` query fragment, omitting it when none is chosen.
 *
 * Omitting rather than sending `default` keeps a download URL identical to the
 * one this client produced before formats existed, so a bookmarked or scripted
 * request is unaffected.
 *
 * @param {string} [exportFormat] Format identifier.
 * @param {boolean} [continuation] True when a query string has already begun.
 * @returns {string} The fragment, or an empty string.
 */
function exportFormatQuery(exportFormat, continuation = false) {
  if (!exportFormat || exportFormat === 'default') return '';
  return `${continuation ? '&' : '?'}export_format=${encodeURIComponent(exportFormat)}`;
}

/**
 * Endpoint helpers.
 *
 * Naming every endpoint in one object means a path change is a single edit, and
 * a component never assembles a URL by hand.
 */
export const api = {
  /* Authentication. */
  checkAvailability: (params) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/auth/availability?${query}`, { auth: false });
  },
  register: (body) => apiRequest('/auth/register', { method: 'POST', body, auth: false }),
  login: (body) => apiRequest('/auth/login', { method: 'POST', body, auth: false }),
  forgotPassword: (body) =>
    apiRequest('/auth/password/forgot', { method: 'POST', body, auth: false }),
  resetPassword: (body) =>
    apiRequest('/auth/password/reset', { method: 'POST', body, auth: false }),
  me: () => apiRequest('/auth/me'),

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
  getNamespace: (namespace) => apiRequest(`/namespaces/${encodeURIComponent(namespace)}`),
  updateNamespace: (namespace, body) =>
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}/settings`, {
      method: 'PATCH',
      body,
    }),
  /**
   * Permanently deletes an organization.
   *
   * The identifier must be echoed in the body; the server rejects a mismatch,
   * which is what stops a misdirected request from deleting the wrong
   * namespace.
   */
  deleteNamespace: (namespace, confirmUserId) =>
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}`, {
      method: 'DELETE',
      body: { confirm_user_id: confirmUserId },
    }),
  listMembers: (namespace) =>
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}/settings/members`),
  addMember: (namespace, body) =>
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}/settings/members`, {
      method: 'POST',
      body,
    }),
  updateMember: (namespace, memberId, body) =>
    apiRequest(
      `/namespaces/${encodeURIComponent(namespace)}/settings/members/${encodeURIComponent(memberId)}`,
      { method: 'PATCH', body },
    ),
  removeMember: (namespace, memberId) =>
    apiRequest(
      `/namespaces/${encodeURIComponent(namespace)}/settings/members/${encodeURIComponent(memberId)}`,
      { method: 'DELETE' },
    ),

  /* Projects. */
  listProjects: (namespace) =>
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}/projects`),
  createProject: (namespace, body) =>
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}/projects`, {
      method: 'POST',
      body,
    }),
  getProject: (projectId) => apiRequest(`/projects/${encodeURIComponent(projectId)}`),
  updateProject: (projectId, body) =>
    apiRequest(`/projects/${encodeURIComponent(projectId)}/settings`, { method: 'PATCH', body }),
  deleteProject: (projectId) =>
    apiRequest(`/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' }),

  /*
   * A project has no credentials of its own. It names a platform and a model,
   * and the key that pays for it comes from the account that owns it. See the
   * namespace credential methods below.
   */

  /* Files. */
  listFiles: (projectId) => apiRequest(`/projects/${encodeURIComponent(projectId)}/files`),
  uploadFile: (projectId, formData) =>
    apiRequest(`/projects/${encodeURIComponent(projectId)}/files`, {
      method: 'POST',
      formData,
    }),
  getFile: (fileId) => apiRequest(`/files/${encodeURIComponent(fileId)}`),
  deleteFile: (fileId) => apiRequest(`/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }),
  reprocessFile: (fileId) =>
    apiRequest(`/files/${encodeURIComponent(fileId)}/reprocess`, { method: 'POST' }),
  addFileLanguages: (fileId, body) =>
    apiRequest(`/files/${encodeURIComponent(fileId)}/languages`, { method: 'POST', body }),
  mergeFileKeys: (fileId, formData) =>
    apiRequest(`/files/${encodeURIComponent(fileId)}/keys`, { method: 'POST', formData }),

  /*
   * Namespace AI credentials.
   *
   * The only credentials there are. They pay for everything the namespace sends
   * to a vendor: translating files inside its projects and answering questions
   * in the assistant alike. Inside an organization every one of them needs
   * ADMIN, reading included, because the list is a statement about the
   * organization's spending.
   */
  listAccountKeys: (namespace) =>
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}/settings/ai_keys`),
  addAccountKey: (namespace, body) =>
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}/settings/ai_keys`, {
      method: 'POST',
      body,
    }),
  updateAccountKey: (namespace, keyId, body) =>
    apiRequest(
      `/namespaces/${encodeURIComponent(namespace)}/settings/ai_keys/${encodeURIComponent(keyId)}`,
      { method: 'PATCH', body },
    ),
  removeAccountKey: (namespace, keyId) =>
    apiRequest(
      `/namespaces/${encodeURIComponent(namespace)}/settings/ai_keys/${encodeURIComponent(keyId)}`,
      { method: 'DELETE' },
    ),
  reorderAccountKeys: (namespace, orderedKeyIds) =>
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}/settings/ai_keys/reorder`, {
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
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}/chat`, {
      method: 'POST',
      ...(payload instanceof FormData ? { formData: payload } : { body: payload }),
    }),
  listChatSessions: (namespace) =>
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}/chat/sessions`),
  getChatSession: (namespace, sessionId) =>
    apiRequest(
      `/namespaces/${encodeURIComponent(namespace)}/chat/sessions/${encodeURIComponent(sessionId)}`,
    ),
  renameChatSession: (namespace, sessionId, title) =>
    apiRequest(
      `/namespaces/${encodeURIComponent(namespace)}/chat/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'PATCH', body: { title } },
    ),
  deleteChatSession: (namespace, sessionId) =>
    apiRequest(
      `/namespaces/${encodeURIComponent(namespace)}/chat/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'DELETE' },
    ),
  searchChats: (namespace, query, limit) =>
    apiRequest(
      `/namespaces/${encodeURIComponent(namespace)}/chat/search?q=${encodeURIComponent(query)}${
        limit ? `&limit=${encodeURIComponent(limit)}` : ''
      }`,
    ),
  backfillChatEmbeddings: (namespace, body = {}) =>
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}/chat/embeddings`, {
      method: 'POST',
      body,
    }),
  getChatLogBuffer: (namespace) =>
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}/chat/log_buffer`),

  /* Export formats. */
  listExportFormats: (namespace) =>
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}/export_formats`),
  createExportFormat: (namespace, body) =>
    apiRequest(`/namespaces/${encodeURIComponent(namespace)}/export_formats`, {
      method: 'POST',
      body,
    }),
  updateExportFormat: (namespace, formatId, body) =>
    apiRequest(
      `/namespaces/${encodeURIComponent(namespace)}/export_formats/${encodeURIComponent(formatId)}`,
      { method: 'PATCH', body },
    ),
  removeExportFormat: (namespace, formatId) =>
    apiRequest(
      `/namespaces/${encodeURIComponent(namespace)}/export_formats/${encodeURIComponent(formatId)}`,
      { method: 'DELETE' },
    ),
  /** The same catalogue, reached from the file being downloaded. */
  listFileExportFormats: (fileId) =>
    apiRequest(`/files/${encodeURIComponent(fileId)}/export_formats`),

  /* Translations. */
  getTranslations: (fileId) => apiRequest(`/files/${encodeURIComponent(fileId)}/translations`),
  updateTranslation: (fileId, translationId, body) =>
    apiRequest(
      `/files/${encodeURIComponent(fileId)}/translations/${encodeURIComponent(translationId)}`,
      { method: 'PATCH', body },
    ),
  updateMasterText: (fileId, keyId, body) =>
    apiRequest(`/files/${encodeURIComponent(fileId)}/keys/${encodeURIComponent(keyId)}`, {
      method: 'PATCH',
      body,
    }),
  /** Refreshes the named keys only. Everything else is left untouched. */
  retranslateKeys: (fileId, body) =>
    apiRequest(`/files/${encodeURIComponent(fileId)}/keys/retranslate`, {
      method: 'POST',
      body,
    }),
  /**
   * Validates that every language still matches the English master.
   *
   * On demand only. The server reads every key and every translation to answer
   * it, which is why nothing calls this on a keystroke.
   */
  checkConsistency: (fileId, lang) =>
    apiRequest(
      `/files/${encodeURIComponent(fileId)}/consistency${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`,
    ),
  /*
   * Downloads.
   *
   * `format` is how the download is packaged and `export_format` is the shape of
   * the documents inside it. They are separate on the server for that reason,
   * and kept separate here so a caller cannot conflate them.
   */
  downloadAll: (fileId, exportFormat) =>
    apiRequest(`/files/${encodeURIComponent(fileId)}/download${exportFormatQuery(exportFormat)}`),
  /** Every locale in one archive, returned as a Blob rather than JSON. */
  downloadArchive: (fileId, exportFormat) =>
    apiRequest(
      `/files/${encodeURIComponent(fileId)}/download?format=zip${exportFormatQuery(exportFormat, true)}`,
      { responseType: 'blob' },
    ),
  downloadLocale: (fileId, lang, exportFormat) =>
    apiRequest(
      `/files/${encodeURIComponent(fileId)}/download?lang=${encodeURIComponent(lang)}${exportFormatQuery(exportFormat, true)}`,
    ),

  /* Catalogue. */
  listProviders: () => apiRequest('/providers', { auth: false }),
};
