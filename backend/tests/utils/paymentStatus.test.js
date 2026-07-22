const {
  DB_CONFIRMED,
  APP_CONFIRMED,
  toDbPaymentStatus,
  toAppPaymentStatus,
  isConfirmedStatus,
  normalizePayment,
  normalizePayments,
  CONFIRMED_DB_STATUSES,
  PENDING_OR_CONFIRMED_DB,
} = require('../../src/utils/paymentStatus');

describe('toDbPaymentStatus', () => {
  it('maps the app "confirmed" status to the db "successful" status', () => {
    expect(toDbPaymentStatus(APP_CONFIRMED)).toBe(DB_CONFIRMED);
  });

  it('passes through any other status unchanged', () => {
    expect(toDbPaymentStatus('pending')).toBe('pending');
    expect(toDbPaymentStatus('failed')).toBe('failed');
    expect(toDbPaymentStatus(DB_CONFIRMED)).toBe(DB_CONFIRMED);
  });
});

describe('toAppPaymentStatus', () => {
  it('maps the db "successful" status to the app "confirmed" status', () => {
    expect(toAppPaymentStatus(DB_CONFIRMED)).toBe(APP_CONFIRMED);
  });

  it('passes through any other status unchanged', () => {
    expect(toAppPaymentStatus('pending')).toBe('pending');
    expect(toAppPaymentStatus('failed')).toBe('failed');
  });
});

describe('isConfirmedStatus', () => {
  it('is true for both db and app confirmed statuses', () => {
    expect(isConfirmedStatus(DB_CONFIRMED)).toBe(true);
    expect(isConfirmedStatus(APP_CONFIRMED)).toBe(true);
  });

  it('is false for non-confirmed statuses', () => {
    expect(isConfirmedStatus('pending')).toBe(false);
    expect(isConfirmedStatus('failed')).toBe(false);
    expect(isConfirmedStatus(undefined)).toBe(false);
  });
});

describe('normalizePayment', () => {
  it('returns falsy input unchanged', () => {
    expect(normalizePayment(null)).toBeNull();
    expect(normalizePayment(undefined)).toBeUndefined();
  });

  it('converts db "successful" status to app "confirmed"', () => {
    const result = normalizePayment({ id: 1, status: DB_CONFIRMED });
    expect(result.status).toBe(APP_CONFIRMED);
    expect(result.id).toBe(1);
  });

  it('promotes a pending payment with confirmed_at to confirmed', () => {
    const result = normalizePayment({ status: 'pending', confirmed_at: '2024-01-01' });
    expect(result.status).toBe(APP_CONFIRMED);
  });

  it('leaves a pending payment without confirmed_at as pending', () => {
    const result = normalizePayment({ status: 'pending', confirmed_at: null });
    expect(result.status).toBe('pending');
  });

  it('does not mutate the original object', () => {
    const original = { status: DB_CONFIRMED };
    normalizePayment(original);
    expect(original.status).toBe(DB_CONFIRMED);
  });
});

describe('normalizePayments', () => {
  it('normalizes each payment in the array', () => {
    const result = normalizePayments([
      { status: DB_CONFIRMED },
      { status: 'pending', confirmed_at: '2024-01-01' },
      { status: 'failed' },
    ]);
    expect(result.map((p) => p.status)).toEqual([APP_CONFIRMED, APP_CONFIRMED, 'failed']);
  });

  it('returns an empty array for an empty input', () => {
    expect(normalizePayments([])).toEqual([]);
  });
});

describe('SQL status fragments', () => {
  it('include both confirmed statuses', () => {
    expect(CONFIRMED_DB_STATUSES).toBe("('successful', 'confirmed')");
    expect(PENDING_OR_CONFIRMED_DB).toBe("('pending', 'successful', 'confirmed')");
  });
});
