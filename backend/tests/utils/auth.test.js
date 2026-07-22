process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

const jwt = require('jsonwebtoken');
const {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateRandomPassword,
  generateResetToken,
  paginate,
} = require('../../src/utils/auth');

describe('password hashing', () => {
  it('produces a bcrypt hash that differs from the plaintext', async () => {
    const hash = await hashPassword('secret123');
    expect(hash).not.toBe('secret123');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('comparePassword returns true for a matching password', async () => {
    const hash = await hashPassword('secret123');
    expect(await comparePassword('secret123', hash)).toBe(true);
  });

  it('comparePassword returns false for a non-matching password', async () => {
    const hash = await hashPassword('secret123');
    expect(await comparePassword('wrong', hash)).toBe(false);
  });
});

describe('JWT tokens', () => {
  it('generates a token that verifies back to the original payload', () => {
    const token = generateToken({ userId: 42, role: 'admin' });
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(42);
    expect(decoded.role).toBe('admin');
  });

  it('signs with the configured secret', () => {
    const token = generateToken({ userId: 1 });
    expect(() => jwt.verify(token, 'test-secret')).not.toThrow();
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });

  it('verifyToken throws on a tampered token', () => {
    expect(() => verifyToken('not.a.jwt')).toThrow();
  });
});

describe('generateRandomPassword', () => {
  it('defaults to a length of 12', () => {
    expect(generateRandomPassword()).toHaveLength(12);
  });

  it('respects a custom length', () => {
    expect(generateRandomPassword(20)).toHaveLength(20);
  });

  it('only uses characters from the allowed set', () => {
    const allowed = /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$]+$/;
    expect(generateRandomPassword(100)).toMatch(allowed);
  });

  it('produces different values across calls', () => {
    expect(generateRandomPassword(24)).not.toBe(generateRandomPassword(24));
  });
});

describe('generateResetToken', () => {
  it('returns a v4 uuid', () => {
    expect(generateResetToken()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});

describe('paginate', () => {
  it('uses defaults of page 1 and limit 20', () => {
    expect(paginate()).toEqual({ offset: 0, limit: 20, page: 1 });
  });

  it('computes the offset from page and limit', () => {
    expect(paginate(3, 10)).toEqual({ offset: 20, limit: 10, page: 3 });
  });

  it('clamps page to a minimum of 1', () => {
    expect(paginate(0, 10)).toEqual({ offset: 0, limit: 10, page: 1 });
    expect(paginate(-5, 10)).toEqual({ offset: 0, limit: 10, page: 1 });
  });

  it('clamps limit between 1 and 100', () => {
    expect(paginate(1, 0).limit).toBe(1);
    expect(paginate(1, 500).limit).toBe(100);
  });

  it('parses numeric string inputs', () => {
    expect(paginate('2', '15')).toEqual({ offset: 15, limit: 15, page: 2 });
  });
});
