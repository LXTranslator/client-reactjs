/**
 * Recent assistant conversations, remembered per namespace.
 *
 * The server addresses a conversation by its session identifier and offers no
 * "list my sessions" endpoint, because a conversation is only ever read back by
 * somebody who already knows which one they mean. That leaves the interface
 * needing somewhere to keep the handful a person has open, so it keeps them
 * here.
 *
 * Two consequences worth being explicit about, since neither is a defect:
 *
 *   - This list is per browser. A conversation started elsewhere is found
 *     through search rather than through this list, which is why the sessions
 *     pane carries a search box rather than only a list.
 *   - Nothing here is authoritative. The entries are identifiers and titles,
 *     the server owns the messages, and an entry naming a session that no
 *     longer exists simply reads as empty when opened.
 *
 * Local storage rather than session storage, deliberately and in the opposite
 * direction from the auth token: a token must not outlive the tab, and a list
 * of conversation titles is the one thing here that should.
 */

/** Storage key prefix. The namespace is appended so two do not mix. */
const STORAGE_PREFIX = 'lxtranslator_chat_sessions_';

/** How many conversations to remember. Older entries fall off the end. */
const MAX_REMEMBERED = 20;

/** Longest title kept, so one very long first message cannot dominate storage. */
const MAX_TITLE_LENGTH = 80;

/**
 * Reads the remembered conversations for a namespace.
 *
 * Tolerates a browser that blocks storage, and tolerates a corrupt value, since
 * neither is worth failing a page over.
 *
 * @param {string} namespace Namespace handle.
 * @returns {Array<{session_id: string, title: string, updated_at: string}>} Entries, newest first.
 */
export function readSessions(namespace) {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${namespace}`);
    if (raw === null) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry) => entry !== null && typeof entry === 'object' && typeof entry.session_id === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Records a conversation, moving it to the front.
 *
 * The title is taken from the first thing asked, which is what a person
 * recognises a conversation by. It is set once and not rewritten by later
 * turns, so a conversation does not rename itself under the cursor.
 *
 * @param {string} namespace Namespace handle.
 * @param {object} entry Conversation.
 * @param {string} entry.session_id Session identifier.
 * @param {string} entry.title Title to show.
 * @returns {Array<object>} The updated list, newest first.
 */
export function rememberSession(namespace, { session_id: sessionId, title }) {
  const existing = readSessions(namespace);
  const previous = existing.find((entry) => entry.session_id === sessionId);

  const next = [
    {
      session_id: sessionId,
      title: previous?.title ?? truncateTitle(title),
      updated_at: new Date().toISOString(),
    },
    ...existing.filter((entry) => entry.session_id !== sessionId),
  ].slice(0, MAX_REMEMBERED);

  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${namespace}`, JSON.stringify(next));
  } catch {
    // A browser with storage disabled still works for the life of the page,
    // because the list is also held in component state.
  }

  return next;
}

/**
 * Forgets one conversation.
 *
 * Local only. The server keeps the log, which is what makes the exchange
 * auditable, so this hides a conversation from this browser rather than
 * deleting anything.
 *
 * @param {string} namespace Namespace handle.
 * @param {string} sessionId Session identifier.
 * @returns {Array<object>} The updated list.
 */
export function forgetSession(namespace, sessionId) {
  const next = readSessions(namespace).filter((entry) => entry.session_id !== sessionId);

  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${namespace}`, JSON.stringify(next));
  } catch {
    // Ignored for the same reason as above.
  }

  return next;
}

/**
 * Shortens a title to something that fits a narrow pane.
 *
 * @param {string} value Candidate title.
 * @returns {string} Title.
 */
function truncateTitle(value) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (text.length === 0) return 'New conversation';
  return text.length <= MAX_TITLE_LENGTH ? text : `${text.slice(0, MAX_TITLE_LENGTH - 1)}…`;
}
