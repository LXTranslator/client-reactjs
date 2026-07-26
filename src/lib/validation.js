/**
 * Client side form validation.
 *
 * Every rule here mirrors a rule the server enforces. The client copy exists to
 * give fast, specific feedback while somebody is typing; it is a convenience,
 * never a control. The server validates independently because anything checked
 * only in the browser can be bypassed entirely.
 *
 * Keep the two in step: when a server schema changes, change the matching
 * validator here so a user is not told something is valid and then rejected.
 */

/** Routing identifier: lowercase letters, digits and underscores, 3 to 32. */
export const USER_ID_PATTERN = /^[a-z0-9_]{3,32}$/;

/** Pragmatic email shape check; deliverability is proven by the email itself. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Locale codes such as `en_us` or `th_th`. */
export const LANG_CODE_PATTERN = /^[a-z]{2}(_[a-z0-9]{2,8})?$/;

/** Project names: letters, digits, spaces, dots, underscores and hyphens. */
export const PROJECT_NAME_PATTERN = /^[A-Za-z0-9 ._-]+$/;

/** Minimum password length. Length carries most of the strength. */
export const PASSWORD_MIN_LENGTH = 10;

/**
 * Example values shown as placeholders.
 *
 * Concrete examples remove far more confusion than a prose description does, so
 * every field in the application gets one.
 */
export const PLACEHOLDERS = Object.freeze({
  userId: 'jetsada_w',
  email: 'you@example.com',
  password: 'At least 10 characters',
  identifier: 'jetsada_w or you@example.com',
  organizationId: 'acme_corp',
  organizationEmail: 'team@acme.com',
  displayName: 'Acme Corporation',
  description: 'What this namespace is used for',
  websiteUrl: 'https://acme.com',
  projectName: 'web_app',
  projectDescription: 'Marketing site strings',
  apiKey: 'your_provider_api_key',
  apiKeyLabel: 'primary',
  memberIdentifier: 'teammate_id or teammate@example.com',
});

/**
 * Validates a routing user id.
 *
 * @param {string} value Candidate value.
 * @returns {string|null} An error message, or null when valid.
 */
export function validateUserId(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length === 0) return 'Enter a user id.';
  if (trimmed.length < 3) return 'The user id must be at least 3 characters.';
  if (trimmed.length > 32) return 'The user id must be 32 characters or fewer.';
  if (/[A-Z]/.test(trimmed)) return 'The user id must be lowercase.';
  if (!USER_ID_PATTERN.test(trimmed)) {
    return 'Use only lowercase letters, digits and underscores.';
  }
  return null;
}

/**
 * Validates an email address.
 *
 * @param {string} value Candidate value.
 * @returns {string|null} An error message, or null when valid.
 */
export function validateEmail(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length === 0) return 'Enter an email address.';
  if (trimmed.length > 254) return 'That email address is too long.';
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address, such as you@example.com.';
  return null;
}

/**
 * Validates a password against the policy.
 *
 * The message names the single missing requirement rather than restating the
 * whole policy, so somebody fixing one problem is not re-read the entire rule.
 *
 * @param {string} value Candidate value.
 * @returns {string|null} An error message, or null when valid.
 */
export function validatePassword(value) {
  const password = String(value ?? '');
  if (password.length === 0) return 'Enter a password.';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `The password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > 200) return 'The password must be 200 characters or fewer.';
  if (!/[a-z]/.test(password)) return 'Add a lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Add an uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Add a digit.';
  return null;
}

/**
 * Checks that a confirmation matches its password.
 *
 * @param {string} password Original value.
 * @param {string} confirmation Repeated value.
 * @returns {string|null} An error message, or null when valid.
 */
export function validatePasswordConfirmation(password, confirmation) {
  if (String(confirmation ?? '').length === 0) return 'Repeat the password.';
  if (password !== confirmation) return 'The passwords do not match.';
  return null;
}

/**
 * Scores a password for the strength meter.
 *
 * Presentational only. It never gates submission; `validatePassword` does that.
 *
 * @param {string} value Candidate value.
 * @returns {{score: number, label: string, color: string}} Meter state.
 */
export function scorePassword(value) {
  const password = String(value ?? '');
  if (password.length === 0) {
    return { score: 0, label: 'Enter a password', color: 'var(--silver-300)' };
  }

  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 14) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const levels = [
    { label: 'Very weak', color: 'var(--sponsor)' },
    { label: 'Weak', color: 'var(--sponsor)' },
    { label: 'Fair', color: 'var(--warn)' },
    { label: 'Good', color: 'var(--accent)' },
    { label: 'Strong', color: 'var(--ok)' },
    { label: 'Very strong', color: 'var(--ok)' },
  ];

  return { score, ...levels[Math.min(score, levels.length - 1)] };
}

/**
 * Validates a login identifier, which may be a user id or an email address.
 *
 * @param {string} value Candidate value.
 * @returns {string|null} An error message, or null when valid.
 */
export function validateIdentifier(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length === 0) return 'Enter your user id or email address.';

  const looksLikeEmail = trimmed.includes('@');
  if (looksLikeEmail) return validateEmail(trimmed);

  if (!USER_ID_PATTERN.test(trimmed.toLowerCase())) {
    return 'Enter a valid user id, or an email address containing an @ sign.';
  }
  return null;
}

/**
 * Validates a project name.
 *
 * @param {string} value Candidate value.
 * @returns {string|null} An error message, or null when valid.
 */
export function validateProjectName(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length === 0) return 'Enter a project name.';
  if (trimmed.length > 100) return 'The project name must be 100 characters or fewer.';
  if (!PROJECT_NAME_PATTERN.test(trimmed)) {
    return 'Use only letters, digits, spaces, dots, underscores and hyphens.';
  }
  return null;
}

/**
 * Validates a provider API key's shape.
 *
 * Only the shape is checked. Whether the credential actually works is proven by
 * the first translation that uses it.
 *
 * @param {string} value Candidate value.
 * @returns {string|null} An error message, or null when valid.
 */
export function validateApiKey(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length === 0) return 'Paste an API key.';
  if (trimmed.length < 8) return 'That does not look like a valid API key.';
  if (trimmed.length > 500) return 'That API key is too long.';
  if (/\s/.test(trimmed)) return 'An API key must not contain spaces.';
  return null;
}

/**
 * Validates an optional website URL.
 *
 * Only `http` and `https` are accepted, because a `javascript:` URL rendered
 * into a link would be a cross site scripting vector.
 *
 * @param {string} value Candidate value.
 * @returns {string|null} An error message, or null when valid or empty.
 */
export function validateWebsiteUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 255) return 'That URL is too long.';

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'Enter a valid URL, such as https://example.com.';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'The URL must start with http:// or https://.';
  }
  return null;
}

/**
 * Validates a locale code.
 *
 * @param {string} value Candidate value.
 * @returns {string|null} An error message, or null when valid.
 */
export function validateLangCode(value) {
  const trimmed = String(value ?? '').trim().toLowerCase();
  if (trimmed.length === 0) return 'Enter a locale code.';
  if (!LANG_CODE_PATTERN.test(trimmed)) {
    return 'Use a locale code such as en_us or th_th.';
  }
  return null;
}

/**
 * Validates a file chosen for upload, before it is sent.
 *
 * Catching an obviously wrong file here saves a round trip. The server repeats
 * every one of these checks and adds content verification on top.
 *
 * @param {File|null} file Selected file.
 * @param {{maxBytes?: number}} [options] Size ceiling.
 * @returns {string|null} An error message, or null when valid.
 */
export function validateTranslationFile(file, options = {}) {
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;

  if (!file) return 'Choose a JSON file to upload.';
  if (!file.name.toLowerCase().endsWith('.json')) {
    return 'Only .json translation files can be uploaded.';
  }
  if (file.size === 0) return 'That file is empty.';
  if (file.size > maxBytes) {
    return `The file must be ${Math.floor(maxBytes / 1024)} KB or smaller.`;
  }
  return null;
}

/**
 * Runs a set of field validators and collects the failures.
 *
 * @param {Record<string, () => (string|null)>} validators Field name to validator.
 * @returns {{errors: Record<string, string>, isValid: boolean}} Collected result.
 */
export function runValidators(validators) {
  const errors = {};
  for (const [field, validator] of Object.entries(validators)) {
    const message = validator();
    if (message !== null && message !== undefined) errors[field] = message;
  }
  return { errors, isValid: Object.keys(errors).length === 0 };
}
