/**
 * Client route construction.
 *
 * A namespace occupies the first path segment, so `/orgA` is the organization
 * `orgA` and `/jetsada` is that person's namespace. Every link is built here
 * rather than assembled inline, because a namespace now appears in nearly every
 * path and a single misspelled segment would send a visitor to a namespace that
 * is not theirs, or to the not found page.
 *
 * The reserved names below are the fixed segments that would otherwise be
 * ambiguous with a namespace. They are refused at registration by the server,
 * and mirrored in `validation.js` so a form says so before submitting.
 */

/**
 * Fixed first segments the router matches before any namespace.
 *
 * `api` and `assets` are not routes here at all: the static server answers them
 * before the application loads, which is exactly why a namespace may not be
 * called either.
 */
export const RESERVED_SEGMENTS: readonly string[] = Object.freeze([
  'api',
  'assets',
  'login',
  'namespaces',
  'organizations',
  'register',
  'settings',
]);

/**
 * Reports whether an identifier collides with a fixed route segment.
 *
 * @param value Candidate namespace identifier.
 * @returns True when the identifier may not be used.
 */
export function isReservedSegment(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return RESERVED_SEGMENTS.includes(value.trim().toLowerCase());
}

/** A value that fills one path segment: an identifier or a numeric id. */
type Segment = string | number;

/**
 * Escapes one path segment.
 *
 * Identifiers are already restricted to characters that need no escaping, so
 * this changes nothing today. It is here so that relaxing the identifier rules
 * later cannot quietly produce a broken URL.
 *
 * @param value Segment value.
 * @returns Escaped segment.
 */
function segment(value: Segment): string {
  return encodeURIComponent(String(value));
}

/**
 * Path builders for every route in the application.
 *
 * Each takes the namespace it acts in, since no page infers one any more.
 */
export const paths = {
  /** Root. Redirects by session state. */
  home: () => '/',
  login: () => '/login',
  register: () => '/register',
  forgotPassword: () => '/forgot-password',
  resetPassword: () => '/reset-password',

  /*
   * Public, and reachable signed in or signed out.
   *
   * Hyphenated deliberately. A namespace owns the first path segment, so a
   * bare `/policy` would have to join RESERVED_SEGMENTS here and
   * RESERVED_IDENTIFIERS on the server — they are one list — and any account
   * already called `policy` would become unreachable. An identifier may not
   * contain a hyphen, so these two can never collide with one.
   */
  privacyPolicy: () => '/privacy-policy',
  termsOfService: () => '/terms-of-service',

  /** Every namespace the visitor can act in. */
  namespaces: () => '/namespaces',
  /** Organization creation. */
  newOrganization: () => '/organizations/new',
  /** The signed in account's own credentials, which belong to no namespace. */
  accountSettings: () => '/settings',
  /*
   * Nested under `/settings`, which is already a reserved segment, so these
   * need no new reservation either.
   */
  twoFactor: () => '/settings/two_factor',
  linkedAccounts: () => '/settings/linked',
  oauthCallback: () => '/oauth-callback',

  /** A namespace, which is its project list. */
  namespace: (namespace: Segment) => `/${segment(namespace)}`,
  namespaceSettings: (namespace: Segment) => `/${segment(namespace)}/settings`,
  namespaceMembers: (namespace: Segment) => `/${segment(namespace)}/settings/members`,
  namespaceExportFormats: (namespace: Segment) => `/${segment(namespace)}/settings/export_formats`,
  namespaceAiSettings: (namespace: Segment) => `/${segment(namespace)}/settings/ai`,
  namespaceChat: (namespace: Segment) => `/${segment(namespace)}/chat`,

  project: (namespace: Segment, projectId: Segment) =>
    `/${segment(namespace)}/project/${segment(projectId)}`,
  projectUploads: (namespace: Segment, projectId: Segment) =>
    `/${segment(namespace)}/project/${segment(projectId)}/uploads`,
  projectSettings: (namespace: Segment, projectId: Segment) =>
    `/${segment(namespace)}/project/${segment(projectId)}/settings`,
  projectFile: (namespace: Segment, projectId: Segment, fileId: Segment) =>
    `/${segment(namespace)}/project/${segment(projectId)}/file/${segment(fileId)}`,
};
