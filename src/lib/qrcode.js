/**
 * A QR code encoder, byte mode, error correction level M.
 *
 * Written here rather than installed, for the reason the server gives for its
 * ZIP writer: the alternative is a dependency on the sign in path, and the
 * problem is bounded. This encodes one short ASCII string — an `otpauth://`
 * URI, around 120 characters — and refuses everything it does not implement
 * rather than guessing.
 *
 * A third party QR service is not an option here regardless. The deployed
 * content security policy sets `img-src 'self' data:` and `connect-src 'self'`,
 * so a remote image or a fetch to a chart API is blocked by the browser. An
 * inline SVG built from the matrix below sidesteps both.
 *
 * What is implemented: byte mode, level M, versions 1 to 10, all eight mask
 * patterns with the standard penalty scoring, and the version information block
 * that versions 7 and above require. What is not: the other three error
 * correction levels, numeric and alphanumeric modes, versions past 10, and
 * Kanji. Anything longer than a level M version 10 payload throws rather than
 * silently producing an unreadable code.
 *
 * The output has been checked module for module against an independent encoder
 * across every version it supports; `tests/qrcode.test.js` carries the fixtures
 * that came out of that comparison.
 */

/** Error correction level M, the only one implemented. */
const EC_LEVEL_BITS = 0b00;

/** Byte mode indicator. */
const MODE_BYTE = 0b0100;

/**
 * Level M block structure, versions 1 to 10.
 *
 * `ecPerBlock` is the error correction codeword count for every block in the
 * version. `groups` lists `[blockCount, dataCodewordsPerBlock]` pairs, because
 * larger versions split into blocks of two different sizes.
 */
const VERSIONS = [
  { version: 1, ecPerBlock: 10, groups: [[1, 16]] },
  { version: 2, ecPerBlock: 16, groups: [[1, 28]] },
  { version: 3, ecPerBlock: 26, groups: [[1, 44]] },
  { version: 4, ecPerBlock: 18, groups: [[2, 32]] },
  { version: 5, ecPerBlock: 24, groups: [[2, 43]] },
  { version: 6, ecPerBlock: 16, groups: [[4, 27]] },
  { version: 7, ecPerBlock: 18, groups: [[4, 31]] },
  { version: 8, ecPerBlock: 22, groups: [[2, 38], [2, 39]] },
  { version: 9, ecPerBlock: 22, groups: [[3, 36], [2, 37]] },
  { version: 10, ecPerBlock: 26, groups: [[4, 43], [1, 44]] },
];

/** Alignment pattern centre coordinates per version. Version 1 has none. */
const ALIGNMENT_CENTRES = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

/* ------------------------------------------------------------------ *
 * GF(256), the field the error correction is computed in.
 * ------------------------------------------------------------------ */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function buildTables() {
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    GF_EXP[index] = value;
    GF_LOG[value] = index;
    value <<= 1;
    // The primitive polynomial for QR, x^8 + x^4 + x^3 + x^2 + 1.
    if (value & 0x100) value ^= 0x11d;
  }
  for (let index = 255; index < 512; index += 1) {
    GF_EXP[index] = GF_EXP[index - 255];
  }
})();

/**
 * Multiplies two field elements.
 *
 * @param {number} left First element.
 * @param {number} right Second element.
 * @returns {number} The product.
 */
function gfMultiply(left, right) {
  if (left === 0 || right === 0) return 0;
  return GF_EXP[GF_LOG[left] + GF_LOG[right]];
}

/**
 * Builds the generator polynomial for a given number of EC codewords.
 *
 * @param {number} degree Error correction codewords per block.
 * @returns {number[]} Polynomial coefficients, highest power first.
 */
function generatorPolynomial(degree) {
  let polynomial = [1];

  for (let index = 0; index < degree; index += 1) {
    const next = new Array(polynomial.length + 1).fill(0);
    for (let position = 0; position < polynomial.length; position += 1) {
      next[position] ^= polynomial[position];
      next[position + 1] ^= gfMultiply(polynomial[position], GF_EXP[index]);
    }
    polynomial = next;
  }

  return polynomial;
}

/**
 * Computes the error correction codewords for one block.
 *
 * @param {number[]} data Data codewords for the block.
 * @param {number} ecCount Error correction codewords wanted.
 * @returns {number[]} The error correction codewords.
 */
function errorCorrectionFor(data, ecCount) {
  const generator = generatorPolynomial(ecCount);
  const remainder = new Array(data.length + ecCount).fill(0);

  for (let index = 0; index < data.length; index += 1) remainder[index] = data[index];

  for (let index = 0; index < data.length; index += 1) {
    const factor = remainder[index];
    if (factor === 0) continue;
    for (let term = 0; term < generator.length; term += 1) {
      remainder[index + term] ^= gfMultiply(generator[term], factor);
    }
  }

  return remainder.slice(data.length);
}

/* ------------------------------------------------------------------ *
 * Bit stream and codewords.
 * ------------------------------------------------------------------ */

/**
 * Chooses the smallest version that holds the payload.
 *
 * @param {number} byteLength Payload length in bytes.
 * @returns {object} The version descriptor.
 * @throws {RangeError} When no supported version is large enough.
 */
function chooseVersion(byteLength) {
  for (const entry of VERSIONS) {
    const dataCodewords = entry.groups.reduce(
      (total, [blocks, perBlock]) => total + blocks * perBlock,
      0,
    );
    // Four bits of mode, then the character count: eight bits below version 10,
    // sixteen from version 10 up.
    const headerBits = 4 + (entry.version < 10 ? 8 : 16);
    if (byteLength * 8 + headerBits <= dataCodewords * 8) return entry;
  }

  throw new RangeError('That value is too long for a level M QR code up to version 10.');
}

/**
 * Turns the payload into interleaved data and error correction codewords.
 *
 * @param {number[]} bytes Payload bytes.
 * @param {object} entry Version descriptor.
 * @returns {number[]} The final codeword sequence.
 */
function buildCodewords(bytes, entry) {
  const countBits = entry.version < 10 ? 8 : 16;
  const bits = [];

  /**
   * Appends a value as a fixed width big endian bit run.
   *
   * @param {number} value Value to append.
   * @param {number} width Bit count.
   * @returns {void}
   */
  function push(value, width) {
    for (let index = width - 1; index >= 0; index -= 1) bits.push((value >> index) & 1);
  }

  push(MODE_BYTE, 4);
  push(bytes.length, countBits);
  for (const byte of bytes) push(byte, 8);

  const dataCodewords = entry.groups.reduce(
    (total, [blocks, perBlock]) => total + blocks * perBlock,
    0,
  );
  const capacityBits = dataCodewords * 8;

  // Terminator, up to four zero bits, then zeros to the next byte boundary.
  for (let index = 0; index < 4 && bits.length < capacityBits; index += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let index = 0; index < bits.length; index += 8) {
    let byte = 0;
    for (let offset = 0; offset < 8; offset += 1) byte = (byte << 1) | bits[index + offset];
    codewords.push(byte);
  }

  /*
   * The two pad codewords the specification names, alternating, and always
   * starting with 0xEC. Anchoring the alternation to the running codeword count
   * instead would start on 0x11 whenever the data happened to end on an odd
   * codeword, which is a difference a decoder tolerates and a reference encoder
   * does not.
   */
  const PAD = [0xec, 0x11];
  for (let padIndex = 0; codewords.length < dataCodewords; padIndex += 1) {
    codewords.push(PAD[padIndex % 2]);
  }

  // Split into blocks, compute error correction per block, then interleave both
  // sets column wise, which is what spreads a burst of damage across blocks.
  const blocks = [];
  let cursor = 0;
  for (const [blockCount, perBlock] of entry.groups) {
    for (let index = 0; index < blockCount; index += 1) {
      const data = codewords.slice(cursor, cursor + perBlock);
      cursor += perBlock;
      blocks.push({ data, ec: errorCorrectionFor(data, entry.ecPerBlock) });
    }
  }

  const result = [];
  const longestData = Math.max(...blocks.map((block) => block.data.length));
  for (let index = 0; index < longestData; index += 1) {
    for (const block of blocks) {
      if (index < block.data.length) result.push(block.data[index]);
    }
  }
  for (let index = 0; index < entry.ecPerBlock; index += 1) {
    for (const block of blocks) result.push(block.ec[index]);
  }

  return result;
}

/* ------------------------------------------------------------------ *
 * The module matrix.
 * ------------------------------------------------------------------ */

/**
 * Creates an empty matrix and the mask marking which modules are reserved.
 *
 * @param {number} size Matrix side length.
 * @returns {{modules: Int8Array[], reserved: Uint8Array[]}} The grids.
 */
function createGrid(size) {
  const modules = [];
  const reserved = [];
  for (let index = 0; index < size; index += 1) {
    modules.push(new Int8Array(size));
    reserved.push(new Uint8Array(size));
  }
  return { modules, reserved };
}

/**
 * Draws one finder pattern and the separator around it.
 *
 * @param {Int8Array[]} modules Module grid.
 * @param {Uint8Array[]} reserved Reservation grid.
 * @param {number} row Top row of the seven by seven pattern.
 * @param {number} column Left column of the pattern.
 * @returns {void}
 */
function drawFinder(modules, reserved, row, column) {
  const size = modules.length;

  for (let deltaRow = -1; deltaRow <= 7; deltaRow += 1) {
    for (let deltaColumn = -1; deltaColumn <= 7; deltaColumn += 1) {
      const targetRow = row + deltaRow;
      const targetColumn = column + deltaColumn;
      if (targetRow < 0 || targetRow >= size || targetColumn < 0 || targetColumn >= size) continue;

      const inRing =
        (deltaRow >= 0 && deltaRow <= 6 && (deltaColumn === 0 || deltaColumn === 6)) ||
        (deltaColumn >= 0 && deltaColumn <= 6 && (deltaRow === 0 || deltaRow === 6));
      const inCore = deltaRow >= 2 && deltaRow <= 4 && deltaColumn >= 2 && deltaColumn <= 4;

      modules[targetRow][targetColumn] = inRing || inCore ? 1 : 0;
      reserved[targetRow][targetColumn] = 1;
    }
  }
}

/**
 * Draws the function patterns every version carries.
 *
 * @param {Int8Array[]} modules Module grid.
 * @param {Uint8Array[]} reserved Reservation grid.
 * @param {number} version Symbol version.
 * @returns {void}
 */
function drawFunctionPatterns(modules, reserved, version) {
  const size = modules.length;

  drawFinder(modules, reserved, 0, 0);
  drawFinder(modules, reserved, 0, size - 7);
  drawFinder(modules, reserved, size - 7, 0);

  // Timing patterns, running between the finders on row and column six.
  for (let index = 8; index < size - 8; index += 1) {
    const value = index % 2 === 0 ? 1 : 0;
    modules[6][index] = value;
    reserved[6][index] = 1;
    modules[index][6] = value;
    reserved[index][6] = 1;
  }

  // Alignment patterns, at every intersection of the version's centres except
  // the three that would sit on a finder.
  const centres = ALIGNMENT_CENTRES[version];
  for (const centreRow of centres) {
    for (const centreColumn of centres) {
      const onFinder =
        (centreRow === 6 && centreColumn === 6) ||
        (centreRow === 6 && centreColumn === size - 7) ||
        (centreRow === size - 7 && centreColumn === 6);
      if (onFinder) continue;

      for (let deltaRow = -2; deltaRow <= 2; deltaRow += 1) {
        for (let deltaColumn = -2; deltaColumn <= 2; deltaColumn += 1) {
          const ring = Math.max(Math.abs(deltaRow), Math.abs(deltaColumn));
          modules[centreRow + deltaRow][centreColumn + deltaColumn] = ring !== 1 ? 1 : 0;
          reserved[centreRow + deltaRow][centreColumn + deltaColumn] = 1;
        }
      }
    }
  }

  // The dark module, always set, always in the same place.
  modules[size - 8][8] = 1;
  reserved[size - 8][8] = 1;

  // Reserve the format information areas; their contents depend on the mask,
  // which is not chosen yet.
  for (let index = 0; index <= 8; index += 1) {
    if (index !== 6) {
      reserved[8][index] = 1;
      reserved[index][8] = 1;
    }
  }
  for (let index = 0; index < 8; index += 1) {
    reserved[8][size - 1 - index] = 1;
    reserved[size - 1 - index][8] = 1;
  }

  // Version information, from version seven up.
  if (version >= 7) {
    const bits = versionInformationBits(version);
    for (let index = 0; index < 18; index += 1) {
      const bit = (bits >> index) & 1;
      const row = Math.floor(index / 3);
      const column = size - 11 + (index % 3);
      modules[row][column] = bit;
      reserved[row][column] = 1;
      modules[column][row] = bit;
      reserved[column][row] = 1;
    }
  }
}

/**
 * Computes the eighteen bit version information block.
 *
 * @param {number} version Symbol version, seven or above.
 * @returns {number} The block.
 */
function versionInformationBits(version) {
  let remainder = version << 12;
  for (let index = 0; index < 12; index += 1) {
    if (remainder & (1 << (17 - index))) {
      remainder ^= 0x1f25 << (5 - index);
    }
  }
  return (version << 12) | (remainder & 0xfff);
}

/**
 * Computes the fifteen bit format information block.
 *
 * @param {number} mask Mask pattern number.
 * @returns {number} The block, already masked with the specified constant.
 */
function formatInformationBits(mask) {
  const data = (EC_LEVEL_BITS << 3) | mask;
  let remainder = data << 10;

  for (let index = 0; index < 5; index += 1) {
    if (remainder & (1 << (14 - index))) {
      remainder ^= 0x537 << (4 - index);
    }
  }

  return ((data << 10) | (remainder & 0x3ff)) ^ 0x5412;
}

/**
 * Writes the format information into both of its copies.
 *
 * The fifteen bits are laid out in a fixed order that is easier to state as a
 * coordinate table than as a run of conditionals, because two things about it
 * are easy to get backwards and neither shows up as a broken looking symbol:
 *
 *   - position zero carries bit **fourteen**, the most significant, not bit
 *     zero;
 *   - the second copy splits after seven positions rather than eight, because
 *     the eighth module of that column is the dark module.
 *
 * @param {Int8Array[]} modules Module grid.
 * @param {number} mask Mask pattern number.
 * @returns {void}
 */
function drawFormatInformation(modules, mask) {
  const size = modules.length;
  const bits = formatInformationBits(mask);

  // Position order 0 to 14, each carrying bits 14 down to 0.
  const around = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];

  const split = [];
  for (let index = 0; index < 7; index += 1) split.push([size - 1 - index, 8]);
  for (let index = 7; index < 15; index += 1) split.push([8, size - 15 + index]);

  for (let index = 0; index < 15; index += 1) {
    const bit = (bits >> (14 - index)) & 1;
    const [aroundRow, aroundColumn] = around[index];
    const [splitRow, splitColumn] = split[index];
    modules[aroundRow][aroundColumn] = bit;
    modules[splitRow][splitColumn] = bit;
  }
}

/**
 * Places the codeword bits in the two module wide zigzag.
 *
 * @param {Int8Array[]} modules Module grid.
 * @param {Uint8Array[]} reserved Reservation grid.
 * @param {number[]} codewords Final codeword sequence.
 * @returns {void}
 */
function placeCodewords(modules, reserved, codewords) {
  const size = modules.length;
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right > 0; right -= 2) {
    // Column six is the vertical timing pattern, and the zigzag steps over it.
    if (right === 6) right -= 1;

    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;

      for (let offset = 0; offset < 2; offset += 1) {
        const column = right - offset;
        if (reserved[row][column]) continue;

        const byte = codewords[bitIndex >> 3];
        const bit = byte === undefined ? 0 : (byte >> (7 - (bitIndex & 7))) & 1;
        modules[row][column] = bit;
        bitIndex += 1;
      }
    }

    upward = !upward;
  }
}

/**
 * Reports whether a module is flipped by a mask pattern.
 *
 * @param {number} mask Mask pattern number.
 * @param {number} row Row index.
 * @param {number} column Column index.
 * @returns {boolean} True when the module flips.
 */
function maskApplies(mask, row, column) {
  switch (mask) {
    case 0:
      return (row + column) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return column % 3 === 0;
    case 3:
      return (row + column) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
    case 5:
      return ((row * column) % 2) + ((row * column) % 3) === 0;
    case 6:
      return (((row * column) % 2) + ((row * column) % 3)) % 2 === 0;
    default:
      return (((row + column) % 2) + ((row * column) % 3)) % 2 === 0;
  }
}

/**
 * Scores a masked matrix against the four penalty rules.
 *
 * Lower is better. The rules exist to discourage patterns a scanner finds hard
 * to read: long same coloured runs, solid blocks, anything resembling a finder,
 * and a strong imbalance between dark and light.
 *
 * @param {Int8Array[]} modules Module grid.
 * @returns {number} The penalty.
 */
function penaltyScore(modules) {
  const size = modules.length;
  let penalty = 0;

  // Rule one: runs of five or more identical modules in a line.
  for (const vertical of [false, true]) {
    for (let line = 0; line < size; line += 1) {
      let runValue = -1;
      let runLength = 0;
      for (let index = 0; index < size; index += 1) {
        const value = vertical ? modules[index][line] : modules[line][index];
        if (value === runValue) {
          runLength += 1;
        } else {
          if (runLength >= 5) penalty += runLength - 2;
          runValue = value;
          runLength = 1;
        }
      }
      if (runLength >= 5) penalty += runLength - 2;
    }
  }

  // Rule two: every two by two block of one colour.
  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      const value = modules[row][column];
      if (
        value === modules[row][column + 1] &&
        value === modules[row + 1][column] &&
        value === modules[row + 1][column + 1]
      ) {
        penalty += 3;
      }
    }
  }

  // Rule three: the finder-like sequence, in either direction.
  const PATTERN = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const REVERSED = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (const vertical of [false, true]) {
    for (let line = 0; line < size; line += 1) {
      for (let index = 0; index + 11 <= size; index += 1) {
        let forward = true;
        let backward = true;
        for (let offset = 0; offset < 11; offset += 1) {
          const value = vertical
            ? modules[index + offset][line]
            : modules[line][index + offset];
          if (value !== PATTERN[offset]) forward = false;
          if (value !== REVERSED[offset]) backward = false;
        }
        if (forward || backward) penalty += 40;
      }
    }
  }

  // Rule four: deviation from an even split of dark and light.
  let dark = 0;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) dark += modules[row][column];
  }
  const percent = (dark * 100) / (size * size);
  penalty += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return penalty;
}

/**
 * Encodes a string as a QR matrix.
 *
 * @param {string} text Value to encode. ASCII only.
 * @param {{mask?: number}} [options] `mask` forces one pattern instead of
 *   scoring all eight. Only the tests use it, to pin a fixture against an
 *   independent encoder without both having to agree on penalty scoring.
 * @returns {{size: number, version: number, mask: number, modules: boolean[][]}} The symbol.
 * @throws {TypeError} When the value is not a non empty string.
 * @throws {RangeError} When it does not fit a supported version.
 */
export function encodeQr(text, options = {}) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new TypeError('A QR payload must be a non empty string.');
  }

  const bytes = Array.from(new TextEncoder().encode(text));
  const entry = chooseVersion(bytes.length);
  const codewords = buildCodewords(bytes, entry);
  const size = entry.version * 4 + 17;

  let best = null;
  const forced = options.mask;
  const candidates = forced === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [forced];

  for (const mask of candidates) {
    const { modules, reserved } = createGrid(size);
    drawFunctionPatterns(modules, reserved, entry.version);
    placeCodewords(modules, reserved, codewords);

    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        if (!reserved[row][column] && maskApplies(mask, row, column)) {
          modules[row][column] ^= 1;
        }
      }
    }

    drawFormatInformation(modules, mask);

    const penalty = penaltyScore(modules);
    if (best === null || penalty < best.penalty) best = { penalty, mask, modules };
  }

  return {
    size,
    version: entry.version,
    mask: best.mask,
    modules: best.modules.map((row) => Array.from(row, (value) => value === 1)),
  };
}
