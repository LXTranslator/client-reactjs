import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { encodeQr } from '../src/lib/qrcode.js';

/**
 * The QR encoder.
 *
 * A QR code that looks like a QR code and does not scan is worse than no QR
 * code at all, because nobody finds out until they are standing there with a
 * phone. So this suite pins the exact output rather than only checking that
 * something plausible came back.
 *
 * The fixtures below were produced by this encoder and then verified with two
 * independent decoders — zxing-cpp read all 213 payload lengths from one byte
 * to the level M version 10 ceiling correctly, and the module grids were
 * compared against an independent encoder, which agreed on every function
 * pattern module in every version. If a change here alters a hash, that is the
 * signal to re-run that comparison rather than to update the fixture.
 *
 * Two bugs this suite exists to prevent coming back, because both produced a
 * symbol that looked entirely correct and decoded as nothing:
 *
 *   - format information written least significant bit first, when position
 *     zero carries bit fourteen;
 *   - the second copy of the format information split after eight positions
 *     instead of seven, putting a format bit where the dark module belongs.
 */

/**
 * Reduces a matrix to a short stable digest.
 *
 * @param {{modules: boolean[][]}} qr Encoder output.
 * @returns {string} Digest.
 */
function digest(qr) {
  const flat = qr.modules.map((row) => row.map((m) => (m ? '1' : '0')).join('')).join('');
  return createHash('sha256').update(flat).digest('hex').slice(0, 32);
}

describe('qr encoder', () => {
  describe('known symbols', () => {
    it.each([
      ['HELLO', 1, 21, 4, '32fbc389880456d584e32bdf2c313723'],
      [
        'otpauth://totp/LXTranslator:jetsada?secret=JBSWY3DPEHPK3PXP&issuer=LXTranslator&algorithm=SHA1&digits=6&period=30',
        7,
        45,
        2,
        '4e026cae39df7e9e08a1170640694d0d',
      ],
      ['x'.repeat(213), 10, 57, 0, 'f673820bb5ccd3f0f6035d879c98fa30'],
    ])('encodes a %#-indexed payload to a verified symbol', (text, version, size, mask, hash) => {
      const qr = encodeQr(text);
      expect(qr.version).toBe(version);
      expect(qr.size).toBe(size);
      expect(qr.mask).toBe(mask);
      expect(digest(qr)).toBe(hash);
    });
  });

  describe('version selection', () => {
    it('grows only as far as the payload needs', () => {
      // Level M byte mode capacities, versions 1 to 10.
      const capacities = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213];

      capacities.forEach((capacity, index) => {
        expect(encodeQr('a'.repeat(capacity)).version).toBe(index + 1);
      });
    });

    it('refuses a payload past the level M version 10 ceiling', () => {
      expect(() => encodeQr('a'.repeat(214))).toThrow(/too long/i);
    });

    it('refuses an empty or non string payload', () => {
      expect(() => encodeQr('')).toThrow(TypeError);
      expect(() => encodeQr(null)).toThrow(TypeError);
    });
  });

  describe('structure', () => {
    const qr = encodeQr(
      'otpauth://totp/LXTranslator:jetsada?secret=JBSWY3DPEHPK3PXP&issuer=LXTranslator',
    );
    const { modules, size } = qr;

    it('is square and sized to its version', () => {
      expect(modules).toHaveLength(size);
      for (const row of modules) expect(row).toHaveLength(size);
      expect(size).toBe(qr.version * 4 + 17);
    });

    it('places a finder pattern in three corners and not the fourth', () => {
      /**
       * @param {number} row Top row.
       * @param {number} column Left column.
       * @returns {boolean} Whether a finder sits there.
       */
      function isFinder(row, column) {
        for (let r = 0; r < 7; r += 1) {
          for (let c = 0; c < 7; c += 1) {
            const ring = r === 0 || r === 6 || c === 0 || c === 6;
            const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
            if (modules[row + r][column + c] !== (ring || core)) return false;
          }
        }
        return true;
      }

      expect(isFinder(0, 0)).toBe(true);
      expect(isFinder(0, size - 7)).toBe(true);
      expect(isFinder(size - 7, 0)).toBe(true);
      expect(isFinder(size - 7, size - 7)).toBe(false);
    });

    it('alternates the timing patterns', () => {
      for (let index = 8; index < size - 8; index += 1) {
        expect(modules[6][index]).toBe(index % 2 === 0);
        expect(modules[index][6]).toBe(index % 2 === 0);
      }
    });

    it('sets the dark module', () => {
      expect(modules[size - 8][8]).toBe(true);
    });
  });

  describe('determinism', () => {
    it('returns the same symbol for the same input', () => {
      const text = 'otpauth://totp/Acme:someone@example.test?secret=MZXW6YTBOI&issuer=Acme';
      expect(digest(encodeQr(text))).toBe(digest(encodeQr(text)));
    });

    it('honours a forced mask, which is what pins the fixtures', () => {
      const text = 'HELLO';
      for (let mask = 0; mask < 8; mask += 1) {
        expect(encodeQr(text, { mask }).mask).toBe(mask);
      }
    });
  });
});
