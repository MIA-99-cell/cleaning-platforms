const { formatCFA } = require('../../src/utils/currencyFormat');

describe('formatCFA', () => {
  it('formats an integer amount with thousands separators and FCFA suffix', () => {
    expect(formatCFA(1000)).toBe('1,000 FCFA');
    expect(formatCFA(1234567)).toBe('1,234,567 FCFA');
  });

  it('formats zero', () => {
    expect(formatCFA(0)).toBe('0 FCFA');
  });

  it('parses numeric strings', () => {
    expect(formatCFA('2500')).toBe('2,500 FCFA');
  });

  it('defaults null/undefined/empty to zero', () => {
    expect(formatCFA(null)).toBe('0 FCFA');
    expect(formatCFA(undefined)).toBe('0 FCFA');
    expect(formatCFA('')).toBe('0 FCFA');
  });

  it('renders NaN for non-numeric input (documents current behavior)', () => {
    expect(formatCFA('abc')).toBe('NaN FCFA');
  });

  it('handles decimal values', () => {
    expect(formatCFA(1234.5)).toBe('1,234.5 FCFA');
  });
});
