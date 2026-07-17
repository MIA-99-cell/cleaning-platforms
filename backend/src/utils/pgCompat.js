const isTruthy = (value) => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null || value === '') return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 't' || normalized === 'yes';
};

const SQL_IS_ACTIVE = "is_active IN (TRUE, '1', 'true', 't', 'yes', 'TRUE')";

module.exports = { isTruthy, SQL_IS_ACTIVE };
