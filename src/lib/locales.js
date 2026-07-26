/**
 * Locale shortlist and upload limits.
 *
 * Shared by the upload page and the translation editor, which both offer a
 * language picker. Keeping one list means a locale added for uploads is
 * immediately offerable on an existing file too.
 */

/**
 * The locales offered as one click choices.
 *
 * A shortlist plus a free text field is easier to use than an exhaustive menu.
 * Anything outside it is still accepted: the server validates the shape of a
 * locale code rather than checking it against a list.
 */
export const COMMON_LOCALES = [
  { code: 'en_us', label: 'English (US)' },
  { code: 'th_th', label: 'Thai' },
  { code: 'ja_jp', label: 'Japanese' },
  { code: 'ko_kr', label: 'Korean' },
  { code: 'zh_cn', label: 'Chinese (Simplified)' },
  { code: 'fr_fr', label: 'French' },
  { code: 'de_de', label: 'German' },
  { code: 'es_es', label: 'Spanish' },
  { code: 'pt_br', label: 'Portuguese (Brazil)' },
  { code: 'vi_vn', label: 'Vietnamese' },
];

/** Mirrors the server's default ceiling. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** The shape the server accepts for a locale code, mirrored for fast feedback. */
export const LOCALE_CODE_PATTERN = /^[a-z]{2}(_[a-z0-9]{2,8})?$/;

/**
 * Validates a locale code the way the server does.
 *
 * @param {string} value Candidate code.
 * @returns {string|null} An error message, or null when valid.
 */
export function validateLocaleCode(value) {
  const trimmed = String(value ?? '').trim().toLowerCase();
  if (trimmed.length === 0) return 'Enter a locale code.';
  if (!LOCALE_CODE_PATTERN.test(trimmed)) {
    return 'Use a locale code such as en_us or th_th.';
  }
  return null;
}
