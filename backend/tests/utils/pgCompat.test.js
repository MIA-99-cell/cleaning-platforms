const { isTruthy, SQL_IS_ACTIVE } = require('../../src/utils/pgCompat');

describe('isTruthy', () => {
  it('returns true for boolean true and numeric 1', () => {
    expect(isTruthy(true)).toBe(true);
    expect(isTruthy(1)).toBe(true);
  });

  it('returns false for boolean false, numeric 0, null, undefined and empty string', () => {
    expect(isTruthy(false)).toBe(false);
    expect(isTruthy(0)).toBe(false);
    expect(isTruthy(null)).toBe(false);
    expect(isTruthy(undefined)).toBe(false);
    expect(isTruthy('')).toBe(false);
  });

  it('recognizes truthy string representations', () => {
    ['1', 'true', 't', 'yes', 'TRUE', 'True', ' Yes '].forEach((v) => {
      expect(isTruthy(v)).toBe(true);
    });
  });

  it('treats other strings as false', () => {
    ['0', 'false', 'f', 'no', 'nope'].forEach((v) => {
      expect(isTruthy(v)).toBe(false);
    });
  });

  it('exposes a SQL fragment covering common active representations', () => {
    expect(SQL_IS_ACTIVE).toContain('is_active IN');
    expect(SQL_IS_ACTIVE).toContain("'true'");
  });
});
