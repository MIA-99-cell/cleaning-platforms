export const formatCFA = (amount) => {
  const num = Number(amount) || 0;
  return `${num.toLocaleString('fr-FR')} FCFA`;
};

export const CURRENCY_LABEL = 'FCFA';
