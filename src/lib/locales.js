/**
 * Locale catalogue, upload limits and locale code validation.
 *
 * Shared by the upload page and the translation editor, which both offer a
 * language picker.
 *
 * The catalogue is long on purpose. A translation tool that only offers the
 * dozen largest languages is not much use to the people working on the rest, so
 * the list is the whole set the product supports rather than a shortlist, and
 * the picker is built to be searched rather than scrolled.
 *
 * Codes are not all two letters. Many locales have no two letter form at all:
 * Bavarian is `bar`, Low German `nds_de`, Malay in Jawi script `zlm_arab`. The
 * server accepts the same shape, and `tests/locale.test.js` there asserts this
 * exact catalogue against it.
 */

/** Every locale the interface offers, ordered by code. */
export const LOCALES = [
  { code: 'af_za', label: 'Afrikaans' },
  { code: 'ar_sa', label: 'Arabic' },
  { code: 'ast_es', label: 'Asturian' },
  { code: 'az_az', label: 'Azerbaijani' },
  { code: 'ba_ru', label: 'Bashkir' },
  { code: 'bar', label: 'Bavarian' },
  { code: 'be_by', label: 'Belarusian (Cyrillic)' },
  { code: 'be_latn', label: 'Belarusian (Latin)' },
  { code: 'bg_bg', label: 'Bulgarian' },
  { code: 'br_fr', label: 'Breton' },
  { code: 'brb', label: 'Brabantian' },
  { code: 'bs_ba', label: 'Bosnian' },
  { code: 'ca_es', label: 'Catalan' },
  { code: 'cv_cu', label: 'Chuvash' },
  { code: 'cs_cz', label: 'Czech' },
  { code: 'cy_gb', label: 'Welsh' },
  { code: 'da_dk', label: 'Danish' },
  { code: 'de_at', label: 'Austrian German' },
  { code: 'de_ch', label: 'Swiss German' },
  { code: 'de_de', label: 'German' },
  { code: 'el_gr', label: 'Greek' },
  { code: 'en_au', label: 'Australian English' },
  { code: 'en_ca', label: 'Canadian English' },
  { code: 'en_gb', label: 'British English' },
  { code: 'en_nz', label: 'New Zealand English' },
  { code: 'en_pt', label: 'Pirate English' },
  { code: 'en_ud', label: 'Upside down British English' },
  { code: 'en_us', label: 'American English' },
  { code: 'enp', label: 'Modern English minus borrowed words' },
  { code: 'enws', label: 'Early Modern English' },
  { code: 'eo_uy', label: 'Esperanto' },
  { code: 'es_ar', label: 'Argentinian Spanish' },
  { code: 'es_cl', label: 'Chilean Spanish' },
  { code: 'es_ec', label: 'Ecuadorian Spanish' },
  { code: 'es_es', label: 'European Spanish' },
  { code: 'es_mx', label: 'Mexican Spanish' },
  { code: 'es_uy', label: 'Uruguayan Spanish' },
  { code: 'es_ve', label: 'Venezuelan Spanish' },
  { code: 'esan', label: 'Andalusian' },
  { code: 'et_ee', label: 'Estonian' },
  { code: 'eu_es', label: 'Basque' },
  { code: 'fa_ir', label: 'Persian' },
  { code: 'fi_fi', label: 'Finnish' },
  { code: 'fil_ph', label: 'Filipino' },
  { code: 'fo_fo', label: 'Faroese' },
  { code: 'fr_ca', label: 'Canadian French' },
  { code: 'fr_ch', label: 'Swiss French' },
  { code: 'fr_fr', label: 'European French' },
  { code: 'fra_de', label: 'East Franconian' },
  { code: 'fur_it', label: 'Friulian' },
  { code: 'fy_nl', label: 'Frisian' },
  { code: 'ga_ie', label: 'Irish' },
  { code: 'gd_gb', label: 'Scottish Gaelic' },
  { code: 'gl_es', label: 'Galician' },
  { code: 'go_fr', label: 'Gallo' },
  { code: 'got_de', label: 'Gothic' },
  { code: 'hal_ua', label: 'Halychian' },
  { code: 'haw_us', label: 'Hawaiian' },
  { code: 'he_il', label: 'Hebrew' },
  { code: 'hi_in', label: 'Hindi' },
  { code: 'hn_no', label: 'High Norwegian' },
  { code: 'hr_hr', label: 'Croatian' },
  { code: 'hu_hu', label: 'Hungarian' },
  { code: 'hy_am', label: 'Armenian' },
  { code: 'id_id', label: 'Indonesian' },
  { code: 'ig_ng', label: 'Igbo' },
  { code: 'io_en', label: 'Ido' },
  { code: 'is_is', label: 'Icelandic' },
  { code: 'isv', label: 'Interslavic' },
  { code: 'it_it', label: 'Italian' },
  { code: 'ja_jp', label: 'Japanese' },
  { code: 'jbo_en', label: 'Lojban' },
  { code: 'ka_ge', label: 'Georgian' },
  { code: 'kk_kz', label: 'Kazakh' },
  { code: 'kn_in', label: 'Kannada' },
  { code: 'ko_kr', label: 'Korean' },
  { code: 'ksh', label: 'Kölsch/Ripuarian' },
  { code: 'kw_gb', label: 'Cornish' },
  { code: 'ky_kg', label: 'Kyrgyz' },
  { code: 'la_la', label: 'Latin' },
  { code: 'lb_lu', label: 'Luxembourgish' },
  { code: 'li_li', label: 'Limburgish' },
  { code: 'lmo', label: 'Lombard' },
  { code: 'lo_la', label: 'Lao' },
  { code: 'lol_us', label: 'LOLCAT' },
  { code: 'lt_lt', label: 'Lithuanian' },
  { code: 'lv_lv', label: 'Latvian' },
  { code: 'lzh', label: 'Literary Chinese' },
  { code: 'mk_mk', label: 'Macedonian' },
  { code: 'mn_mn', label: 'Mongolian' },
  { code: 'ms_my', label: 'Malay' },
  { code: 'mt_mt', label: 'Maltese' },
  { code: 'nah', label: 'Nahuatl' },
  { code: 'nds_de', label: 'Low German' },
  { code: 'nl_be', label: 'Dutch, Flemish' },
  { code: 'nl_nl', label: 'Dutch' },
  { code: 'nn_no', label: 'Norwegian Nynorsk' },
  { code: 'no_no', label: 'Norwegian Bokmål' },
  { code: 'oc_fr', label: 'Occitan' },
  { code: 'ovd', label: 'Elfdalian' },
  { code: 'pl_pl', label: 'Polish' },
  { code: 'pls', label: 'Popoloca' },
  { code: 'pt_br', label: 'Brazilian Portuguese' },
  { code: 'pt_pt', label: 'European Portuguese' },
  { code: 'qcb_es', label: 'Cantabrian' },
  { code: 'qid', label: 'Indonesian (Pre-reform spelling)' },
  { code: 'qya_aa', label: 'Quenya (Form of Elvish from The Lord of the Rings)' },
  { code: 'ro_ro', label: 'Romanian' },
  { code: 'rpr', label: 'Russian (Pre-revolutionary)' },
  { code: 'ru_ru', label: 'Russian' },
  { code: 'ry_ua', label: 'Rusyn' },
  { code: 'sah_sah', label: 'Yakut' },
  { code: 'se_no', label: 'Northern Sami' },
  { code: 'sk_sk', label: 'Slovak' },
  { code: 'sl_si', label: 'Slovenian' },
  { code: 'so_so', label: 'Somali' },
  { code: 'sq_al', label: 'Albanian' },
  { code: 'sr_cs', label: 'Serbian (Latin)' },
  { code: 'sr_sp', label: 'Serbian (Cyrillic)' },
  { code: 'sv_se', label: 'Swedish' },
  { code: 'sxu', label: 'Upper Saxon German' },
  { code: 'szl', label: 'Silesian' },
  { code: 'ta_in', label: 'Tamil' },
  { code: 'th_th', label: 'Thai' },
  { code: 'tl_ph', label: 'Tagalog' },
  { code: 'tlh_aa', label: 'Klingon' },
  { code: 'tok', label: 'Toki Pona' },
  { code: 'tr_tr', label: 'Turkish' },
  { code: 'tt_ru', label: 'Tatar' },
  { code: 'tzo_mx', label: 'Tzotzil' },
  { code: 'uk_ua', label: 'Ukrainian' },
  { code: 'uz_uz', label: 'Uzbek' },
  { code: 'val_es', label: 'Valencian' },
  { code: 'vec_it', label: 'Venetian' },
  { code: 'vro', label: 'Võro' },
  { code: 'vi_vn', label: 'Vietnamese' },
  { code: 'vp_vl', label: 'Viossa' },
  { code: 'yi_de', label: 'Yiddish' },
  { code: 'yo_ng', label: 'Yoruba' },
  { code: 'zh_cn', label: 'Chinese Simplified (Chinese Mainland; Mandarin)' },
  { code: 'zh_hk', label: 'Chinese Traditional (Hong Kong SAR)' },
  { code: 'zh_tw', label: 'Chinese Traditional (Taiwan; Mandarin)' },
  { code: 'zlm_arab', label: 'Malay (Jawi)' },
];

/** Locale codes offered first, before the catalogue is searched. */
const SUGGESTED_CODES = [
  'en_us',
  'es_es',
  'fr_fr',
  'de_de',
  'pt_br',
  'ru_ru',
  'ar_sa',
  'hi_in',
  'zh_cn',
  'ja_jp',
  'ko_kr',
  'th_th',
];

/**
 * A short list of widely used locales, shown before anyone starts searching.
 *
 * Having 143 choices with no starting point is its own kind of unusable, so the
 * picker opens on these and the rest is a letter or a search away.
 */
export const SUGGESTED_LOCALES = SUGGESTED_CODES.map((code) =>
  LOCALES.find((locale) => locale.code === code),
).filter(Boolean);

/** Locale record by code, for turning a stored code back into a name. */
const LOCALES_BY_CODE = new Map(LOCALES.map((locale) => [locale.code, locale]));

/**
 * Names a locale code for display.
 *
 * A code outside the catalogue is still valid, since the server validates shape
 * rather than membership, so it is returned as it stands rather than hidden.
 *
 * @param {string} code Locale code.
 * @returns {string} The language name, or the code itself.
 */
export function localeLabel(code) {
  return LOCALES_BY_CODE.get(code)?.label ?? code;
}

/**
 * The letter a locale files under in an A to Z index.
 *
 * Diacritics are folded, so Võro files under V and not past Z, and anything
 * that does not start with a Latin letter files under a single bucket rather
 * than vanishing from the index.
 *
 * @param {{label: string}} locale Locale record.
 * @returns {string} A single uppercase letter, or `#`.
 */
export function localeInitial(locale) {
  const folded = locale.label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  const first = folded[0] ?? '';
  return first >= 'A' && first <= 'Z' ? first : '#';
}

/** The alphabet the index offers, with a bucket for everything else. */
export const LOCALE_INITIALS = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  '#',
].filter((letter) => LOCALES.some((locale) => localeInitial(locale) === letter));

/**
 * Filters the catalogue by initial letter and free text.
 *
 * Both the name and the code are searched, because people arrive knowing one or
 * the other: `pt_br` and `Brazilian` should each find the same row.
 *
 * @param {object} [options] Filter options.
 * @param {string} [options.initial] Single letter, or `#`, or empty for all.
 * @param {string} [options.search] Free text over name and code.
 * @param {string[]} [options.exclude] Codes to leave out.
 * @returns {Array<{code: string, label: string}>} Matching locales.
 */
export function filterLocales({ initial = '', search = '', exclude = [] } = {}) {
  const excluded = new Set(exclude);
  const needle = search.trim().toLowerCase();

  return LOCALES.filter((locale) => {
    if (excluded.has(locale.code)) return false;
    if (initial !== '' && localeInitial(locale) !== initial) return false;
    if (needle === '') return true;
    return (
      locale.label.toLowerCase().includes(needle) || locale.code.toLowerCase().includes(needle)
    );
  });
}

/** Mirrors the server's default ceiling. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * The shape the server accepts for a locale code, mirrored for fast feedback.
 *
 * Two to eight lowercase letters, optionally followed by an underscore and a
 * region or script subtag. Kept in step with `LANG_CODE_PATTERN` on the server.
 */
export const LOCALE_CODE_PATTERN = /^[a-z]{2,8}(_[a-z0-9]{2,8})?$/;

/**
 * Validates a locale code the way the server does.
 *
 * Membership of the catalogue is deliberately not required: the server accepts
 * any well formed code, so a locale it does not list is still usable.
 *
 * @param {string} value Candidate code.
 * @returns {string|null} An error message, or null when valid.
 */
export function validateLocaleCode(value) {
  const trimmed = String(value ?? '').trim().toLowerCase();
  if (trimmed.length === 0) return 'Enter a locale code.';
  if (!LOCALE_CODE_PATTERN.test(trimmed)) {
    return 'Use a locale code such as en_us, th_th or nds_de.';
  }
  return null;
}
