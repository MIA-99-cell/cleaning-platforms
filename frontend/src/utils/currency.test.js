import { describe, it, expect } from 'vitest';
import { formatCFA, CURRENCY_LABEL } from './currency';

// Intl in the fr-FR locale uses a narrow no-break space (\u202f) as the
// thousands separator, so assertions normalize whitespace before comparing.
const normalize = (s) => s.replace(/\s/g, ' ');

describe('formatCFA', () => {
  it('formats an integer with grouped thousands and the FCFA suffix', () => {
    expect(normalize(formatCFA(1000))).toBe('1 000 FCFA');
    expect(normalize(formatCFA(1234567))).toBe('1 234 567 FCFA');
  });

  it('formats zero', () => {
    expect(formatCFA(0)).toBe('0 FCFA');
  });

  it('coerces numeric strings', () => {
    expect(normalize(formatCFA('2500'))).toBe('2 500 FCFA');
  });

  it('falls back to zero for null, undefined and empty input', () => {
    expect(formatCFA(null)).toBe('0 FCFA');
    expect(formatCFA(undefined)).toBe('0 FCFA');
    expect(formatCFA('')).toBe('0 FCFA');
  });

  it('falls back to zero for non-numeric input', () => {
    expect(formatCFA('abc')).toBe('0 FCFA');
  });
});

describe('CURRENCY_LABEL', () => {
  it('is FCFA', () => {
    expect(CURRENCY_LABEL).toBe('FCFA');
  });
});
