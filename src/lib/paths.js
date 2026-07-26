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
export const RESERVED_SEGMENTS = Object.freeze([
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
 * @param {string} value Candidate namespace identifier.
 * @returns {boolean} True when the identifier may not be used.
 */
export function isReservedSegment(value) {
  if (typeof value !== 'string') return false;
  return RESERVED_SEGMENTS.includes(value.trim().toLowerCase());
}

/**
 * Escapes one path segment.
 *
 * Identifiers are already restricted to characters that need no escaping, so
 * this changes nothing today. It is here so that relaxing the identifier rules
 * later cannot quietly produce a broken URL.
 *
 * @param {string|number} value Segment value.
 * @returns {string} Escaped segment.
 */
function segment(value) {
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

  /** Every namespace the visitor can act in. */
  namespaces: () => '/namespaces',
  /** Organization creation. */
  newOrganization: () => '/organizations/new',
  /** The signed in account's own credentials, which belong to no namespace. */
  accountSettings: () => '/settings',

  /** A namespace, which is its project list. */
  namespace: (namespace) => `/${segment(namespace)}`,
  namespaceSettings: (namespace) => `/${segment(namespace)}/settings`,
  namespaceMembers: (namespace) => `/${segment(namespace)}/settings/members`,
  namespaceExportFormats: (namespace) => `/${segment(namespace)}/settings/export_formats`,
  namespaceAiSettings: (namespace) => `/${segment(namespace)}/settings/ai`,
  namespaceChat: (namespace) => `/${segment(namespace)}/chat`,

  project: (namespace, projectId) => `/${segment(namespace)}/project/${segment(projectId)}`,
  projectUploads: (namespace, projectId) =>
    `/${segment(namespace)}/project/${segment(projectId)}/uploads`,
  projectSettings: (namespace, projectId) =>
    `/${segment(namespace)}/project/${segment(projectId)}/settings`,
  projectFile: (namespace, projectId, fileId) =>
    `/${segment(namespace)}/project/${segment(projectId)}/file/${segment(fileId)}`,
};
