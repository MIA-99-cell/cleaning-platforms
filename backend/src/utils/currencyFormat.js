const formatCFA = (amount) => {
  const value = parseFloat(amount || 0);
  return `${value.toLocaleString('en-US')} FCFA`;
};

module.exports = { formatCFA };
