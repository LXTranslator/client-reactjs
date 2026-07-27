import { describe, expect, it } from 'vitest';
import {
  LOCALES,
  LOCALE_INITIALS,
  SUGGESTED_LOCALES,
  filterLocales,
  localeInitial,
  localeLabel,
  validateLocaleCode,
} from '../src/lib/locales.js';

describe('locale catalogue', () => {
  it('holds the whole supported set', () => {
    expect(LOCALES).toHaveLength(143);
  });

  it('has no duplicate codes', () => {
    const codes = LOCALES.map((locale) => locale.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('has no duplicate names either', () => {
    // Two rows reading the same in the picker is a dead end: there is no way to
    // tell which one to choose. Script and region variants are distinguished by
    // a parenthetical, which is what keeps Belarusian (Cyrillic) and Belarusian
    // (Latin) two usable choices rather than one repeated.
    const labels = LOCALES.map((locale) => locale.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('carries a name for every code', () => {
    expect(LOCALES.every((locale) => locale.label.trim().length > 0)).toBe(true);
  });

  it('accepts every one of its own codes', () => {
    // A code the picker offers and the validator rejects is a dead end reached
    // only after choosing it.
    const rejected = LOCALES.filter((locale) => validateLocaleCode(locale.code) !== null);
    expect(rejected).toEqual([]);
  });

  it('includes locales with no two letter form', () => {
    const codes = LOCALES.map((locale) => locale.code);
    expect(codes).toEqual(
      expect.arrayContaining(['bar', 'nds_de', 'zlm_arab', 'sah_sah', 'tok', 'lzh']),
    );
  });

  it('opens on a suggested set drawn from the catalogue', () => {
    expect(SUGGESTED_LOCALES.length).toBeGreaterThan(0);
    for (const locale of SUGGESTED_LOCALES) {
      expect(LOCALES).toContainEqual(locale);
    }
  });
});

describe('localeLabel', () => {
  it('names a code', () => {
    expect(localeLabel('nds_de')).toBe('Low German');
    expect(localeLabel('pt_br')).toBe('Brazilian Portuguese');
  });

  it('returns an unknown code as it stands', () => {
    // The server validates shape rather than membership, so a code outside the
    // catalogue is legitimate and must not be hidden.
    expect(localeLabel('xx_yy')).toBe('xx_yy');
  });
});

describe('localeInitial', () => {
  it('files a plain name under its first letter', () => {
    expect(localeInitial({ label: 'Thai' })).toBe('T');
  });

  it('folds diacritics so an accented name files where it is looked for', () => {
    // Võro under V, not past Z; Kölsch under K.
    expect(localeInitial({ label: 'Võro' })).toBe('V');
    expect(localeInitial({ label: 'Kölsch/Ripuarian' })).toBe('K');
  });

  it('buckets anything that does not start with a Latin letter', () => {
    expect(localeInitial({ label: '中文' })).toBe('#');
  });

  it('offers only letters that have entries', () => {
    for (const letter of LOCALE_INITIALS) {
      expect(filterLocales({ initial: letter }).length).toBeGreaterThan(0);
    }
  });
});

describe('filterLocales', () => {
  it('returns everything when unfiltered', () => {
    expect(filterLocales()).toHaveLength(LOCALES.length);
  });

  it('narrows to one initial letter', () => {
    const results = filterLocales({ initial: 'K' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((locale) => localeInitial(locale) === 'K')).toBe(true);
    expect(results.map((locale) => locale.code)).toContain('ksh');
  });

  it('searches the name', () => {
    expect(filterLocales({ search: 'brazil' }).map((locale) => locale.code)).toEqual(['pt_br']);
  });

  it('searches the code, since people arrive knowing one or the other', () => {
    expect(filterLocales({ search: 'pt_br' }).map((locale) => locale.code)).toEqual(['pt_br']);
  });

  it('ignores case and surrounding space', () => {
    expect(filterLocales({ search: '  THAI  ' }).map((locale) => locale.code)).toEqual(['th_th']);
  });

  it('combines a letter with a search', () => {
    const results = filterLocales({ initial: 'S', search: 'serbian' });
    expect(results.map((locale) => locale.code).sort()).toEqual(['sr_cs', 'sr_sp']);
  });

  it('leaves out excluded codes', () => {
    const results = filterLocales({ search: 'thai', exclude: ['th_th'] });
    expect(results).toEqual([]);
  });

  it('returns nothing for a search that matches nothing', () => {
    expect(filterLocales({ search: 'not a language' })).toEqual([]);
  });
});

describe('validateLocaleCode', () => {
  it('accepts codes of two to eight letters, with or without a subtag', () => {
    for (const code of ['en_us', 'th_th', 'bar', 'nds_de', 'zlm_arab', 'sah_sah']) {
      expect(validateLocaleCode(code)).toBeNull();
    }
  });

  it('rejects a malformed code', () => {
    for (const code of ['', 'e', 'en-us', 'en us', 'en/us', 'en_us.json', 'abcdefghi']) {
      expect(validateLocaleCode(code)).toMatch(/locale code/);
    }
  });

  it('normalises case and space before judging', () => {
    expect(validateLocaleCode('  PT_BR  ')).toBeNull();
  });
});
