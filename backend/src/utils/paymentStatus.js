const DB_CONFIRMED = 'successful';
const APP_CONFIRMED = 'confirmed';

const CONFIRMED_STATUSES = new Set([DB_CONFIRMED, APP_CONFIRMED]);

const toDbPaymentStatus = (status) => (
  status === APP_CONFIRMED ? DB_CONFIRMED : status
);

const toAppPaymentStatus = (status) => (
  status === DB_CONFIRMED ? APP_CONFIRMED : status
);

const isConfirmedStatus = (status) => CONFIRMED_STATUSES.has(status);

const normalizePayment = (payment) => {
  if (!payment) return payment;
  let status = toAppPaymentStatus(payment.status);
  if (status === 'pending' && payment.confirmed_at) {
    status = APP_CONFIRMED;
  }
  return { ...payment, status };
};

const normalizePayments = (payments) => payments.map(normalizePayment);

const CONFIRMED_DB_STATUSES = `('${DB_CONFIRMED}', '${APP_CONFIRMED}')`;
const PENDING_OR_CONFIRMED_DB = `('pending', '${DB_CONFIRMED}', '${APP_CONFIRMED}')`;

module.exports = {
  DB_CONFIRMED,
  APP_CONFIRMED,
  toDbPaymentStatus,
  toAppPaymentStatus,
  isConfirmedStatus,
  normalizePayment,
  normalizePayments,
  CONFIRMED_DB_STATUSES,
  PENDING_OR_CONFIRMED_DB,
};
