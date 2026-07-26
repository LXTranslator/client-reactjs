import { describe, expect, it } from 'vitest';
import {
  scorePassword,
  validateApiKey,
  validateEmail,
  validateIdentifier,
  validateLangCode,
  validatePassword,
  validatePasswordConfirmation,
  validateProjectName,
  validateTranslationFile,
  validateUserId,
  validateWebsiteUrl,
  runValidators,
} from '../src/lib/validation.js';

describe('validation', () => {
  describe('user id', () => {
    it('accepts a well formed id', () => {
      expect(validateUserId('jetsada_w')).toBeNull();
      expect(validateUserId('abc')).toBeNull();
      expect(validateUserId('a'.repeat(32))).toBeNull();
    });

    it('rejects one that is too short or too long', () => {
      expect(validateUserId('ab')).toMatch(/at least 3/);
      expect(validateUserId('a'.repeat(33))).toMatch(/32 characters or fewer/);
    });

    it('names uppercase specifically rather than giving a generic message', () => {
      // A caller who typed a capital gets told exactly that, instead of being
      // left to work out which rule they broke.
      expect(validateUserId('Jetsada')).toMatch(/lowercase/);
    });

    it('rejects punctuation and spaces', () => {
      expect(validateUserId('jetsada-w')).toMatch(/lowercase letters, digits/);
      expect(validateUserId('jetsada w')).toMatch(/lowercase letters, digits/);
      expect(validateUserId('jetsada!')).toMatch(/lowercase letters, digits/);
    });

    it.each(['api', 'assets', 'login', 'namespaces', 'organizations', 'register', 'settings'])(
      'rejects %s, which the router already claims',
      (reserved) => {
        // A namespace sits at the first path segment, so one of these would be
        // shadowed by a fixed route and never render. The server refuses them
        // too; this mirrors that so the form says so before submitting.
        expect(validateUserId(reserved)).toMatch(/reserved/);
      },
    );

    it('leaves an ordinary name alone', () => {
      // The list covers real route collisions only, not vanity reservations.
      expect(validateUserId('admin')).toBeNull();
      expect(validateUserId('project')).toBeNull();
    });

    it('rejects an empty value', () => {
      expect(validateUserId('')).toMatch(/Enter a user id/);
    });
  });

  describe('email', () => {
    it('accepts a plausible address', () => {
      expect(validateEmail('you@example.com')).toBeNull();
      expect(validateEmail('first.last+tag@sub.example.co.uk')).toBeNull();
    });

    it('rejects a malformed address', () => {
      for (const value of ['plain', 'no@domain', 'no-at.example.com', 'a@b@c.com', '']) {
        expect(validateEmail(value)).not.toBeNull();
      }
    });
  });

  describe('password', () => {
    it('accepts one meeting the policy', () => {
      expect(validatePassword('Str0ngPassphrase')).toBeNull();
    });

    it('names the single missing requirement', () => {
      // The message points at one thing to fix rather than restating the whole
      // policy each time.
      expect(validatePassword('short1A')).toMatch(/at least 10/);
      expect(validatePassword('alllowercase1')).toMatch(/uppercase/);
      expect(validatePassword('ALLUPPERCASE1')).toMatch(/lowercase/);
      expect(validatePassword('NoDigitsHere')).toMatch(/digit/);
    });

    it('checks the confirmation matches', () => {
      expect(validatePasswordConfirmation('abc', 'abc')).toBeNull();
      expect(validatePasswordConfirmation('abc', 'abd')).toMatch(/do not match/);
      expect(validatePasswordConfirmation('abc', '')).toMatch(/Repeat/);
    });

    it('scores strength without gating submission', () => {
      expect(scorePassword('').score).toBe(0);
      expect(scorePassword('Str0ngPassphrase!').score).toBeGreaterThan(
        scorePassword('abc').score,
      );
    });
  });

  describe('login identifier', () => {
    it('accepts a user id or an email address', () => {
      expect(validateIdentifier('jetsada_w')).toBeNull();
      expect(validateIdentifier('you@example.com')).toBeNull();
    });

    it('validates as an email once an at sign is present', () => {
      expect(validateIdentifier('broken@')).not.toBeNull();
    });

    it('rejects something that is neither', () => {
      expect(validateIdentifier('has spaces')).not.toBeNull();
      expect(validateIdentifier('')).toMatch(/Enter your user id/);
    });
  });

  describe('project name', () => {
    it('accepts letters, digits and mild punctuation', () => {
      expect(validateProjectName('web_app')).toBeNull();
      expect(validateProjectName('Marketing Site v2')).toBeNull();
      expect(validateProjectName('api-docs')).toBeNull();
    });

    it('rejects an empty or hostile name', () => {
      expect(validateProjectName('')).toMatch(/Enter a project name/);
      expect(validateProjectName('../etc')).not.toBeNull();
      expect(validateProjectName('<script>')).not.toBeNull();
    });
  });

  describe('website url', () => {
    it('treats an empty value as valid, since the field is optional', () => {
      expect(validateWebsiteUrl('')).toBeNull();
    });

    it('accepts http and https', () => {
      expect(validateWebsiteUrl('https://example.com')).toBeNull();
      expect(validateWebsiteUrl('http://example.com/path')).toBeNull();
    });

    it('rejects a javascript url', () => {
      // Rendering this into a link would be a cross site scripting vector.
      expect(validateWebsiteUrl('javascript:alert(1)')).toMatch(/http:\/\/ or https:\/\//);
    });

    it('rejects other schemes and malformed values', () => {
      expect(validateWebsiteUrl('ftp://example.com')).not.toBeNull();
      expect(validateWebsiteUrl('data:text/html,x')).not.toBeNull();
      expect(validateWebsiteUrl('not a url')).not.toBeNull();
    });
  });

  describe('api key', () => {
    it('accepts a plausible key', () => {
      expect(validateApiKey('sk_live_abcdef1234')).toBeNull();
    });

    it('rejects an empty, short or spaced value', () => {
      expect(validateApiKey('')).toMatch(/Paste an API key/);
      expect(validateApiKey('short')).toMatch(/does not look like/);
      expect(validateApiKey('has spaces in it')).toMatch(/must not contain spaces/);
    });
  });

  describe('locale code', () => {
    it('accepts a well formed code', () => {
      expect(validateLangCode('en_us')).toBeNull();
      expect(validateLangCode('th_th')).toBeNull();
      expect(validateLangCode('fr')).toBeNull();
    });

    it('rejects anything that could reach a filename', () => {
      expect(validateLangCode('../etc')).not.toBeNull();
      expect(validateLangCode('en-US')).not.toBeNull();
      expect(validateLangCode('')).toMatch(/Enter a locale code/);
    });
  });

  describe('translation file', () => {
    /**
     * Builds a stand in for a browser File object.
     *
     * @param {string} name Filename.
     * @param {number} size Size in bytes.
     * @returns {object} File like value.
     */
    function fakeFile(name, size) {
      return { name, size };
    }

    it('accepts a reasonable json file', () => {
      expect(validateTranslationFile(fakeFile('en_us.json', 2048))).toBeNull();
    });

    it('requires a file at all', () => {
      expect(validateTranslationFile(null)).toMatch(/Choose a JSON file/);
    });

    it('rejects a non json extension', () => {
      expect(validateTranslationFile(fakeFile('payload.txt', 100))).toMatch(/Only .json/);
    });

    it('rejects an empty or oversized file', () => {
      expect(validateTranslationFile(fakeFile('en_us.json', 0))).toMatch(/empty/);
      expect(
        validateTranslationFile(fakeFile('en_us.json', 5 * 1024 * 1024), {
          maxBytes: 2 * 1024 * 1024,
        }),
      ).toMatch(/or smaller/);
    });
  });

  describe('runValidators', () => {
    it('collects every failure and reports validity', () => {
      const result = runValidators({
        a: () => null,
        b: () => 'b failed',
        c: () => 'c failed',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual({ b: 'b failed', c: 'c failed' });
    });

    it('reports valid when nothing fails', () => {
      expect(runValidators({ a: () => null }).isValid).toBe(true);
    });
  });
});
