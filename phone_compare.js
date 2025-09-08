// phone_compare.js
// High-quality US phone number normalization & comparison (NANP-aware)
//
// API:
//   normalizeUsNumber(raw, { allowLocal7=false } = {}) -> { raw, base, ext, valid, reason }
//   sameUsNumber(a, b, { matchExtension=true, allowLocal7=false, strictValidation=true } = {}) -> boolean
//
// Notes:
// - Ignores formatting (spaces, (), -, ., slashes, etc.)
// - Handles vanity letters via T9 mapping (e.g., 1-800-FLOWERS)
// - Accepts +1 / 1 / 001 / 011-1 and trims to NANP base (10 digits)
// - Parses extensions: x, xt, ext, ext., extension, #1234, ;ext=123 (tel/sip URI parameter)
// - Validates NANP basics by default: area code & exchange start 2–9
// - Optionally allow 7-digit local numbers (allowLocal7)
// - Optionally ignore extensions (matchExtension=false)
// - Optionally relax validation (strictValidation=false)
//
// © 2025. MIT License.

(function (global) {
  'use strict';

  const LETTER_TO_DIGIT = new Map();
  const sets = [
    ['ABC', '2'], ['DEF', '3'], ['GHI', '4'], ['JKL', '5'],
    ['MNO', '6'], ['PQRS', '7'], ['TUV', '8'], ['WXYZ', '9']
  ];
  for (const [letters, d] of sets) {
    for (const ch of letters) {
      LETTER_TO_DIGIT.set(ch, d);
      LETTER_TO_DIGIT.set(ch.toLowerCase(), d);
    }
  }

  const EXT_TRAILING_RE = /(?:^|[\s,.;\-])(?:ext(?:ension)?\.?|x|xt|#)\s*[:\-\.]?\s*([A-Za-z0-9]+)\s*$/i;
  const EXT_URI_RE = /;\s*ext\s*=\s*([A-Za-z0-9]+)\s*$/i;
  const LEADING_SCHEME_RE = /^(?:tel:|sip:)/i;

  function transliterateLetters(s) {
    if (!s) return s;
    let out = '';
    for (const ch of s) {
      if (/[A-Za-z]/.test(ch) && LETTER_TO_DIGIT.has(ch)) {
        out += LETTER_TO_DIGIT.get(ch);
      } else {
        out += ch;
      }
    }
    return out;
  }

  function splitBaseAndExtension(s) {
    s = (s || '').trim();
    s = s.replace(LEADING_SCHEME_RE, '');

    const mUri = s.match(EXT_URI_RE);
    let mTrailing = null;
    const trailingRe = new RegExp(EXT_TRAILING_RE.source, EXT_TRAILING_RE.flags);
    let tmp;
    while ((tmp = trailingRe.exec(s)) !== null) {
      mTrailing = tmp; // keep last
    }

    if (mUri && (!mTrailing || mUri.index > mTrailing.index)) {
      const ext = mUri[1];
      const base = s.slice(0, mUri.index).trim();
      return [base, ext];
    }
    if (mTrailing) {
      const ext = mTrailing[1];
      const base = (s.slice(0, mTrailing.index) + s.slice(mTrailing.index + mTrailing[0].length)).trim();
      return [base, ext];
    }
    return [s, null];
  }

  function stripIddAndCountry(d) {
    if (!d) return d;
    // Remove typical international dialing prefixes and country code 1
    if (d.startsWith('011')) d = d.slice(3);
    if (d.startsWith('00')) d = d.slice(2);
    d = d.replace(/^\+/, '');
    if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
    while (d.length > 10 && d.startsWith('1')) d = d.slice(1);
    return d;
  }

  function nanpBasicValid(d, allowLocal7) {
    if (!d) return [false, 'No digits'];
    if (allowLocal7 && d.length === 7) {
      if (d[0] === '0' || d[0] === '1') return [false, 'Local 7-digit: exchange cannot start with 0/1'];
      return [true, null];
    }
    if (d.length !== 10) return [false, `Expected 10 digits, got ${d.length}`];
    if (d[0] === '0' || d[0] === '1') return [false, 'Area code cannot start with 0/1'];
    if (d[3] === '0' || d[3] === '1') return [false, 'Exchange code cannot start with 0/1'];
    return [true, null];
  }

  function normalizeUsNumber(raw, { allowLocal7 = false } = {}) {
    const [baseRaw, extRaw] = splitBaseAndExtension(String(raw ?? ''));
    const baseAlpha = transliterateLetters(baseRaw);
    const extAlpha = transliterateLetters(extRaw);

    let baseDigits = (baseAlpha.match(/\d/g) || []).join('');
    let extDigits = extAlpha ? (extAlpha.match(/\d/g) || []).join('') : null;

    baseDigits = stripIddAndCountry(baseDigits);
    const [valid, reason] = nanpBasicValid(baseDigits, allowLocal7);

    if (extDigits === '') extDigits = null;
    if (baseDigits === '') {
      return { raw, base: null, ext: extDigits, valid: false, reason: 'No digits found' };
    }
    return { raw, base: baseDigits, ext: extDigits, valid, reason };
  }

  function sameUsNumber(a, b, {
    matchExtension = true,
    allowLocal7 = false,
    strictValidation = true
  } = {}) {
    const na = normalizeUsNumber(a, { allowLocal7 });
    const nb = normalizeUsNumber(b, { allowLocal7 });

    if (strictValidation && (!na.valid || !nb.valid)) return false;
    if (!na.base || !nb.base) return false;
    if (na.base !== nb.base) return false;

    if (matchExtension) {
      const ea = na.ext || '';
      const eb = nb.ext || '';
      return ea === eb;
    }
    return true;
  }

  // Expose
  const API = { normalizeUsNumber, sameUsNumber };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.PhoneCompare = API;
  }
})(typeof window !== 'undefined' ? window : globalThis);
