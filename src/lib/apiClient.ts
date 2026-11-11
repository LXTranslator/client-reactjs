/**
 * HTTP client for the LXTranslator API.
 *
 * Responsibilities kept deliberately narrow: build the request, attach the
 * session token, unwrap the response envelope, and turn a failure into a typed
 * error the interface can render. No component talks to `fetch` directly, so
 * error handling and token attachment cannot drift between pages.
 */

import type {
  Account,
  AccountKey,
  ApiToken,
  AuthProvider,
  ChatReply,
  ChatSearchMatch,
  ChatSession,
  ChatTurn,
  ConsistencyReport,
  ExportFormat,
  FileTranslations,
  JsonBody,
  LoginResult,
  Member,
  Namespace,
  NamespaceProfile,
  OauthIdentity,
  Project,
  ProjectFile,
  ProviderCatalogue,
  SessionGrant,
  SessionRecord,
  Translation,
  TwoFactorEnrolment,
  TwoFactorStatus,
  UsageEntry,
  UsageSummary,
} from './types.ts';

/** Base path. The dev server proxies this to the backend, so it stays relative. */
const API_BASE: string = import.meta.env?.VITE_API_BASE_URL ?? '/api/v1';

/** One field level validation failure, as the API reports it. */
export interface FieldErrorDetail {
  field: string;
  message: string;
}

/** Detail an {@link ApiError} carries beyond its message. */
export interface ApiErrorOptions {
  /** HTTP status code. */
  status: number;
  /** Stable machine readable code. */
  code?: string | null;
  /** Field errors. */
  details?: FieldErrorDetail[] | null;
}

/**
 * Error carrying the API's structured failure detail.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly details: FieldErrorDetail[] | null;

  /**
   * @param message Client safe message from the API.
   * @param options Additional detail.
   */
  constructor(message: string, { status, code, details }: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code ?? null;
    this.details = details ?? null;
  }

  /**
   * Maps field level validation failures onto form field names.
   *
   * @returns Field name to message.
   */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(this.details.map((entry) => [entry.field, entry.message]));
  }

  /** @returns True when the session is missing or expired. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/** In memory session token. */
let authToken: string | null = null;

/**
 * Storage key. Session storage is used rather than local storage so the token
 * does not outlive the browser tab.
 */
const TOKEN_STORAGE_KEY = 'lxtranslator_token';

/**
 * Reads the stored token, tolerating a browser that blocks storage.
 *
 * @returns The token, or null.
 */
function readStoredToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Sets the token used for subsequent requests.
 *
 * @param token Session token, or null to clear it.
 */
export function setAuthToken(token: string | null): void {
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
 * @returns The token, or null.
 */
export function getAuthToken(): string | null {
  if (authToken === null) authToken = readStoredToken();
  return authToken;
}

/** Options for {@link apiRequest}. */
export interface RequestOptions {
  /** HTTP method. */
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** JSON body. */
  body?: unknown;
  /** Multipart body, used for uploads. */
  formData?: FormData;
  /** Attach the session token. Defaults to true. */
  auth?: boolean;
  /** Cancellation signal. */
  signal?: AbortSignal;
  /**
   * Return the raw body instead of unwrapping an envelope. Required for any
   * endpoint that serves a file, since those send the document itself and have
   * no `data` field to unwrap.
   */
  responseType?: 'blob';
}

/** The error envelope every failed JSON response carries. */
interface ErrorEnvelope {
  error?: { message?: string; code?: string; details?: FieldErrorDetail[] };
  data?: unknown;
}

/**
 * Performs a request and unwraps the response.
 *
 * The result type is the caller's statement of what the endpoint returns. It
 * is not checked at run time, which is why every caller goes through a typed
 * helper on {@link api} rather than naming a type at each call site.
 *
 * @param path Path below the API base.
 * @param options Request options.
 * @returns The `data` payload, or the body for a blob request.
 * @throws {ApiError} When the request fails.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, auth = true, signal, responseType } = options;

  const headers: Record<string, string> = {};
  if (auth) {
    const token = getAuthToken();
    if (token !== null) headers.Authorization = `Bearer ${token}`;
  }

  // The browser must set the multipart boundary itself, so Content-Type is
  // only declared for JSON bodies.
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
      signal,
    });
  } catch (error) {
    if ((error as Error | null)?.name === 'AbortError') throw error;
    throw new ApiError('Could not reach the server. Check your connection and try again.', {
      status: 0,
      code: 'NETWORK_ERROR',
    });
  }

  if (response.status === 204) return null as T;

  /*
   * A binary response carries no JSON to unwrap. The error path still parses
   * one, because a failure returns the usual error envelope whatever the caller
   * asked for.
   */
  if (responseType === 'blob' && response.ok) {
    return (await response.blob()) as T;
  }

  let payload: ErrorEnvelope | null = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    payload = await response.json().catch((): null => null);
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
  return (payload?.data ?? null) as T;
}

/**
 * Builds an endpoint path, encoding every interpolated value as one segment.
 *
 * Used as a template tag, so `endpoint\`/files/${fileId}\`` cannot forget to
 * encode an identifier and a value holding a slash can never reach a different
 * route.
 *
 * @param strings Literal parts of the template.
 * @param values Interpolated segments.
 * @returns The path.
 */
function endpoint(strings: TemplateStringsArray, ...values: Array<string | number>): string {
  return strings.reduce(
    (path, part, index) => path + encodeURIComponent(values[index - 1] as string | number) + part,
  );
}

/** A value a query parameter may carry. An absent one is left out. */
type QueryValue = string | number | null | undefined;

/**
 * Appends a query string built from the parameters that carry a value.
 *
 * An absent, null or empty parameter is left out rather than sent empty, so an
 * optional filter costs nothing in the URL when it is not used.
 *
 * @param path Endpoint path.
 * @param params Query parameters.
 * @returns The path with its query string, if any.
 */
function withQuery(path: string, params: Record<string, QueryValue>): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]): [string, string] => [key, String(value)]);
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
 * @param exportFormat Format identifier.
 * @returns The identifier, or undefined for the default.
 */
function exportFormatParam(exportFormat?: string): string | undefined {
  return exportFormat === 'default' ? undefined : exportFormat;
}

/** The identifier the availability probe asks about. */
export type AvailabilityQuery = { user_id: string } | { email: string };

/** Whether an identifier or an address is still free. Only the asked one is sent. */
export interface Availability {
  user_id_available?: boolean;
  email_available?: boolean;
}

/**
 * What a reset request answers. A development server also hands back the
 * token, since it sends no email.
 */
export interface PasswordResetRequest {
  message?: string;
  development_token?: string | null;
}

/** Fresh recovery codes, shown once. */
export interface RecoveryCodes {
  recovery_codes: string[];
}

/**
 * Endpoint helpers.
 *
 * Naming every endpoint in one object means a path change is a single edit, and
 * a component never assembles a URL by hand.
 */
export const api = {
  /* Authentication. */
  checkAvailability: (params: AvailabilityQuery) =>
    apiRequest<Availability>(withQuery('/auth/availability', params), { auth: false }),
  register: (body: JsonBody) =>
    apiRequest<SessionGrant>('/auth/register', { method: 'POST', body, auth: false }),
  login: (body: JsonBody) =>
    apiRequest<LoginResult>('/auth/login', { method: 'POST', body, auth: false }),
  forgotPassword: (body: JsonBody) =>
    apiRequest<PasswordResetRequest>('/auth/password/forgot', {
      method: 'POST',
      body,
      auth: false,
    }),
  resetPassword: (body: JsonBody) =>
    apiRequest<null>('/auth/password/reset', { method: 'POST', body, auth: false }),
  me: () => apiRequest<{ account: Account }>('/auth/me'),

  /* The second factor. */
  getTwoFactor: () => apiRequest<TwoFactorStatus>('/auth/mfa'),
  setupTwoFactor: (body: JsonBody) =>
    apiRequest<TwoFactorEnrolment>('/auth/mfa/setup', { method: 'POST', body }),
  enableTwoFactor: (body: JsonBody) =>
    apiRequest<RecoveryCodes>('/auth/mfa/enable', { method: 'POST', body }),
  disableTwoFactor: (body: JsonBody) =>
    apiRequest<null>('/auth/mfa/disable', { method: 'POST', body }),
  regenerateRecoveryCodes: (body: JsonBody) =>
    apiRequest<RecoveryCodes>('/auth/mfa/recovery_codes', { method: 'POST', body }),
  // Unauthenticated: the caller holds a challenge, which is not a session and
  // can do nothing else.
  completeMfaChallenge: (body: JsonBody) =>
    apiRequest<SessionGrant>('/auth/login/mfa', { method: 'POST', body, auth: false }),

  /* Provider sign in. */
  listAuthProviders: () =>
    apiRequest<{ providers?: AuthProvider[] }>('/auth/oauth/providers', { auth: false }),
  startOauthLogin: (provider: string) =>
    apiRequest<{ authorize_url: string }>(endpoint`/auth/oauth/${provider}/login/start`, {
      method: 'POST',
      body: {},
      auth: false,
    }),
  completeOauthLogin: (body: JsonBody) =>
    apiRequest<LoginResult>('/auth/oauth/login/callback', { method: 'POST', body, auth: false }),
  startOauthLink: (provider: string) =>
    apiRequest<{ authorize_url: string }>(endpoint`/auth/oauth/${provider}/link/start`, {
      method: 'POST',
      body: {},
    }),
  completeOauthLink: (body: JsonBody) =>
    apiRequest<{ provider: string }>('/auth/oauth/link/callback', { method: 'POST', body }),
  listOauthIdentities: () => apiRequest<{ identities?: OauthIdentity[] }>('/auth/oauth/identities'),
  unlinkOauthProvider: (provider: string) =>
    apiRequest<null>(endpoint`/auth/oauth/${provider}`, { method: 'DELETE' }),

  /* Account settings. */
  getSettings: () => apiRequest<{ account: Account }>('/settings'),
  confirmPassword: (body: JsonBody) =>
    apiRequest<{ token: string; expires_in?: number }>('/settings/confirm', {
      method: 'POST',
      body,
    }),
  updateUserId: (body: JsonBody) =>
    apiRequest<{ account: Account }>('/settings/identifier', { method: 'PATCH', body }),
  updateEmail: (body: JsonBody) =>
    apiRequest<{ account: Account }>('/settings/email', { method: 'PATCH', body }),
  updatePassword: (body: JsonBody) =>
    apiRequest<null>('/settings/password', { method: 'PATCH', body }),
  updateProfile: (body: JsonBody) =>
    apiRequest<{ account: Account }>('/settings/profile', { method: 'PATCH', body }),

  /* Namespaces and organizations. */
  listNamespaces: () => apiRequest<{ namespaces?: Namespace[] }>('/namespaces'),
  createOrganization: (body: JsonBody) =>
    apiRequest<{ namespace: Namespace }>('/namespaces/organizations', { method: 'POST', body }),
  getNamespace: (namespace: string) =>
    apiRequest<{ namespace: NamespaceProfile }>(endpoint`/namespaces/${namespace}`),
  updateNamespace: (namespace: string, body: JsonBody) =>
    apiRequest<{ namespace: NamespaceProfile }>(endpoint`/namespaces/${namespace}/settings`, {
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
  deleteNamespace: (namespace: string, confirmUserId: string) =>
    apiRequest<null>(endpoint`/namespaces/${namespace}`, {
      method: 'DELETE',
      body: { confirm_user_id: confirmUserId },
    }),
  listMembers: (namespace: string) =>
    apiRequest<{ members?: Member[] }>(endpoint`/namespaces/${namespace}/settings/members`),
  addMember: (namespace: string, body: JsonBody) =>
    apiRequest<{ member: Member }>(endpoint`/namespaces/${namespace}/settings/members`, {
      method: 'POST',
      body,
    }),
  updateMember: (namespace: string, memberId: string, body: JsonBody) =>
    apiRequest<{ member: Member }>(
      endpoint`/namespaces/${namespace}/settings/members/${memberId}`,
      {
        method: 'PATCH',
        body,
      },
    ),
  removeMember: (namespace: string, memberId: string) =>
    apiRequest<null>(endpoint`/namespaces/${namespace}/settings/members/${memberId}`, {
      method: 'DELETE',
    }),

  /*
   * Sessions and API tokens.
   *
   * A session is a row on the server now, so signing out ends it there rather
   * than only forgetting the token here. An API token is the credential a
   * script uses; it is returned once by `createApiToken` and never again.
   */
  logout: () => apiRequest<null>('/auth/logout', { method: 'POST' }),
  listSessions: () => apiRequest<{ sessions?: SessionRecord[] }>('/auth/sessions'),
  revokeSession: (sessionId: string) =>
    apiRequest<null>(endpoint`/auth/sessions/${sessionId}`, { method: 'DELETE' }),
  revokeOtherSessions: () =>
    apiRequest<{ revoked: number }>('/auth/sessions/revoke_others', { method: 'POST' }),
  listApiTokens: () => apiRequest<{ api_tokens?: ApiToken[] }>('/auth/api_tokens'),
  createApiToken: (body: JsonBody) =>
    apiRequest<{ token: string; api_token: ApiToken }>('/auth/api_tokens', {
      method: 'POST',
      body,
    }),
  revokeApiToken: (tokenId: string) =>
    apiRequest<null>(endpoint`/auth/api_tokens/${tokenId}`, { method: 'DELETE' }),
  listUsage: ({ sessionId, limit }: { sessionId?: string; limit?: number } = {}) =>
    apiRequest<{ usage?: UsageEntry[] }>(
      withQuery('/auth/usage', { session_id: sessionId, limit }),
    ),
  getUsageSummary: (days?: number) =>
    apiRequest<UsageSummary>(withQuery('/auth/usage/summary', { days })),

  /* Projects. */
  listProjects: (namespace: string) =>
    apiRequest<{ projects?: Project[] }>(endpoint`/namespaces/${namespace}/projects`),
  createProject: (namespace: string, body: JsonBody) =>
    apiRequest<{ project: Project }>(endpoint`/namespaces/${namespace}/projects`, {
      method: 'POST',
      body,
    }),
  getProject: (projectId: string) =>
    apiRequest<{ project: Project }>(endpoint`/projects/${projectId}`),
  updateProject: (projectId: string, body: JsonBody) =>
    apiRequest<{ project: Project }>(endpoint`/projects/${projectId}/settings`, {
      method: 'PATCH',
      body,
    }),
  deleteProject: (projectId: string) =>
    apiRequest<null>(endpoint`/projects/${projectId}`, { method: 'DELETE' }),

  /*
   * A project has no credentials of its own. It names a platform and a model,
   * and the key that pays for it comes from the account that owns it. See the
   * namespace credential methods below.
   */

  /* Files. */
  listFiles: (projectId: string) =>
    apiRequest<{ files?: ProjectFile[] }>(endpoint`/projects/${projectId}/files`),
  uploadFile: (projectId: string, formData: FormData) =>
    apiRequest<{ file: ProjectFile }>(endpoint`/projects/${projectId}/files`, {
      method: 'POST',
      formData,
    }),
  getFile: (fileId: string) => apiRequest<{ file: ProjectFile }>(endpoint`/files/${fileId}`),
  deleteFile: (fileId: string) =>
    apiRequest<null>(endpoint`/files/${fileId}`, { method: 'DELETE' }),
  reprocessFile: (fileId: string) =>
    apiRequest<{ file: ProjectFile }>(endpoint`/files/${fileId}/reprocess`, { method: 'POST' }),
  addFileLanguages: (fileId: string, body: JsonBody) =>
    apiRequest<{ added?: string[] } | null>(endpoint`/files/${fileId}/languages`, {
      method: 'POST',
      body,
    }),
  mergeFileKeys: (fileId: string, formData: FormData) =>
    apiRequest<{ existing_key_count?: number } | null>(endpoint`/files/${fileId}/keys`, {
      method: 'POST',
      formData,
    }),

  /*
   * Namespace AI credentials.
   *
   * The only credentials there are. They pay for everything the namespace sends
   * to a vendor: translating files inside its projects and answering questions
   * in the assistant alike. Inside an organization every one of them needs
   * ADMIN, reading included, because the list is a statement about the
   * organization's spending.
   */
  listAccountKeys: (namespace: string) =>
    apiRequest<{ keys?: AccountKey[] }>(endpoint`/namespaces/${namespace}/settings/ai_keys`),
  addAccountKey: (namespace: string, body: JsonBody) =>
    apiRequest<{ key: AccountKey }>(endpoint`/namespaces/${namespace}/settings/ai_keys`, {
      method: 'POST',
      body,
    }),
  updateAccountKey: (namespace: string, keyId: string, body: JsonBody) =>
    apiRequest<{ key: AccountKey }>(endpoint`/namespaces/${namespace}/settings/ai_keys/${keyId}`, {
      method: 'PATCH',
      body,
    }),
  removeAccountKey: (namespace: string, keyId: string) =>
    apiRequest<null>(endpoint`/namespaces/${namespace}/settings/ai_keys/${keyId}`, {
      method: 'DELETE',
    }),
  reorderAccountKeys: (namespace: string, orderedKeyIds: string[]) =>
    apiRequest<{ keys?: AccountKey[] }>(
      endpoint`/namespaces/${namespace}/settings/ai_keys/reorder`,
      {
        method: 'POST',
        body: { ordered_key_ids: orderedKeyIds },
      },
    ),

  /*
   * The assistant.
   *
   * A turn may carry an attachment, so `sendChat` takes either a JSON body or a
   * FormData. The browser must set the multipart boundary itself, which is why
   * the two are kept apart rather than always sending a form.
   */
  sendChat: (namespace: string, payload: JsonBody | FormData) =>
    apiRequest<ChatReply>(endpoint`/namespaces/${namespace}/chat`, {
      method: 'POST',
      ...(payload instanceof FormData ? { formData: payload } : { body: payload }),
    }),
  listChatSessions: (namespace: string) =>
    apiRequest<{ sessions?: ChatSession[] }>(endpoint`/namespaces/${namespace}/chat/sessions`),
  getChatSession: (namespace: string, sessionId: string) =>
    apiRequest<{ session?: ChatSession; turns?: ChatTurn[] }>(
      endpoint`/namespaces/${namespace}/chat/sessions/${sessionId}`,
    ),
  renameChatSession: (namespace: string, sessionId: string, title: string) =>
    apiRequest<{ session: ChatSession }>(
      endpoint`/namespaces/${namespace}/chat/sessions/${sessionId}`,
      {
        method: 'PATCH',
        body: { title },
      },
    ),
  deleteChatSession: (namespace: string, sessionId: string) =>
    apiRequest<null>(endpoint`/namespaces/${namespace}/chat/sessions/${sessionId}`, {
      method: 'DELETE',
    }),
  searchChats: (namespace: string, query: string, limit?: number) =>
    apiRequest<{ results?: ChatSearchMatch[] }>(
      withQuery(endpoint`/namespaces/${namespace}/chat/search`, { q: query, limit }),
    ),
  backfillChatEmbeddings: (namespace: string, body: JsonBody = {}) =>
    apiRequest<{ embedded?: number }>(endpoint`/namespaces/${namespace}/chat/embeddings`, {
      method: 'POST',
      body,
    }),
  getChatLogBuffer: (namespace: string) =>
    apiRequest<{ entries?: unknown[] }>(endpoint`/namespaces/${namespace}/chat/log_buffer`),

  /* Export formats. */
  listExportFormats: (namespace: string) =>
    apiRequest<{ export_formats?: ExportFormat[] }>(
      endpoint`/namespaces/${namespace}/export_formats`,
    ),
  createExportFormat: (namespace: string, body: JsonBody) =>
    apiRequest<{ export_format: ExportFormat }>(endpoint`/namespaces/${namespace}/export_formats`, {
      method: 'POST',
      body,
    }),
  updateExportFormat: (namespace: string, formatId: string, body: JsonBody) =>
    apiRequest<{ export_format: ExportFormat }>(
      endpoint`/namespaces/${namespace}/export_formats/${formatId}`,
      {
        method: 'PATCH',
        body,
      },
    ),
  removeExportFormat: (namespace: string, formatId: string) =>
    apiRequest<null>(endpoint`/namespaces/${namespace}/export_formats/${formatId}`, {
      method: 'DELETE',
    }),
  /** The same catalogue, reached from the file being downloaded. */
  listFileExportFormats: (fileId: string) =>
    apiRequest<{ export_formats?: ExportFormat[] }>(endpoint`/files/${fileId}/export_formats`),

  /* Translations. */
  getTranslations: (fileId: string) =>
    apiRequest<FileTranslations>(endpoint`/files/${fileId}/translations`),
  updateTranslation: (fileId: string, translationId: string, body: JsonBody) =>
    apiRequest<{ translation: Translation }>(
      endpoint`/files/${fileId}/translations/${translationId}`,
      {
        method: 'PATCH',
        body,
      },
    ),
  updateMasterText: (fileId: string, keyId: string, body: JsonBody) =>
    apiRequest<{ changed: boolean; stale_lang_codes: string[] }>(
      endpoint`/files/${fileId}/keys/${keyId}`,
      { method: 'PATCH', body },
    ),
  /** Refreshes the named keys only. Everything else is left untouched. */
  retranslateKeys: (fileId: string, body: JsonBody) =>
    apiRequest<{ queued?: number }>(endpoint`/files/${fileId}/keys/retranslate`, {
      method: 'POST',
      body,
    }),
  /**
   * Validates that every language still matches the English master.
   *
   * On demand only. The server reads every key and every translation to answer
   * it, which is why nothing calls this on a keystroke.
   */
  checkConsistency: (fileId: string, lang?: string) =>
    apiRequest<ConsistencyReport>(withQuery(endpoint`/files/${fileId}/consistency`, { lang })),

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
  downloadAll: (fileId: string, exportFormat?: string) =>
    apiRequest<Blob>(
      withQuery(endpoint`/files/${fileId}/download`, {
        export_format: exportFormatParam(exportFormat),
      }),
      { responseType: 'blob' },
    ),
  downloadArchive: (fileId: string, exportFormat?: string) =>
    apiRequest<Blob>(
      withQuery(endpoint`/files/${fileId}/download`, {
        format: 'zip',
        export_format: exportFormatParam(exportFormat),
      }),
      { responseType: 'blob' },
    ),
  downloadLocale: (fileId: string, lang?: string, exportFormat?: string) =>
    apiRequest<Blob>(
      withQuery(endpoint`/files/${fileId}/download`, {
        lang,
        export_format: exportFormatParam(exportFormat),
      }),
      { responseType: 'blob' },
    ),

  /* Catalogue. */
  listProviders: () => apiRequest<ProviderCatalogue>('/providers', { auth: false }),
};
